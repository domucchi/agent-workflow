import { Hono } from 'hono'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

type JsonValue = Record<string, unknown>

const workflowHome = resolve(process.env.AGENT_WORKFLOW_HOME || `${process.env.HOME}/.agent-workflow`)
const repoRoot = resolve(import.meta.dir, '../../..')
const binDir = join(repoRoot, 'bin')
const distDir = resolve(import.meta.dir, '../dist')
const token = process.env.AGENT_CP_TOKEN || readEnvToken()
const host = process.env.AGENT_CP_HOST || '127.0.0.1'
const port = Number(process.env.AGENT_CP_PORT || '45731')

if (!token) {
  throw new Error('AGENT_CP_TOKEN is required')
}
if (!isAllowedHost(host)) {
  throw new Error(`refusing to bind non-loopback/non-Tailscale host: ${host}`)
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`invalid AGENT_CP_PORT: ${process.env.AGENT_CP_PORT}`)
}

const app = new Hono()

app.get('/', () => serveIndex())
app.get('/assets/*', (c) => serveAsset(c.req.path))
app.get('/health', (c) => c.json({ ok: true }))

app.use('/api/*', async (c, next) => {
  const header = c.req.header('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const explicit = c.req.header('x-agent-token') || ''
  if (bearer !== token && explicit !== token) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
})

app.get('/api/health', (c) => c.json(health()))
app.get('/api/worktrees', async (c) => {
  const projectId = c.req.query('projectId') || c.req.query('project_id') || ''
  return c.json({ worktrees: await readWorktrees(projectId, c.req.url) })
})
app.get('/api/editors', (c) => c.json({ editors: installedEditors() }))
app.post('/api/worktrees/:task/dev', async (c) => devAction(c.req.param('task'), await body(c)))
app.post('/api/worktrees/:task/cleanup', async (c) => cleanupAction(c.req.param('task'), await body(c)))
app.post('/api/worktrees/:task/worktrees/:worktreeId/cleanup', async (c) => cleanupWorktreeAction(c.req.param('task'), c.req.param('worktreeId'), await body(c)))
app.post('/api/preview', async (c) => previewAction(await body(c), c.req.url))
app.post('/api/open', async (c) => openAction(await body(c)))
app.post('/api/leases/reap', async (c) => reapLeaseAction(await body(c)))

app.get('/worktrees', async (c) => {
  const unauthorized = authorizeAlias(c.req.header('authorization'), c.req.header('x-agent-token'))
  if (unauthorized) return unauthorized
  return c.json({ worktrees: await readWorktrees(c.req.query('projectId') || c.req.query('project_id') || '', c.req.url) })
})
app.post('/worktrees/:task/dev', async (c) => {
  const unauthorized = authorizeAlias(c.req.header('authorization'), c.req.header('x-agent-token'))
  if (unauthorized) return unauthorized
  return devAction(c.req.param('task'), await body(c))
})
app.post('/worktrees/:task/cleanup', async (c) => {
  const unauthorized = authorizeAlias(c.req.header('authorization'), c.req.header('x-agent-token'))
  if (unauthorized) return unauthorized
  return cleanupAction(c.req.param('task'), await body(c))
})
app.post('/preview', async (c) => {
  const unauthorized = authorizeAlias(c.req.header('authorization'), c.req.header('x-agent-token'))
  if (unauthorized) return unauthorized
  return previewAction(await body(c), c.req.url)
})

app.get('*', () => serveIndex())

function authorizeAlias(authorization = '', explicit = '') {
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (bearer !== token && explicit !== token) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    })
  }
  return null
}

async function body(c: { req: { json: () => Promise<JsonValue> } }) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

function serveIndex() {
  const file = Bun.file(join(distDir, 'index.html'))
  if (!existsSync(join(distDir, 'index.html'))) {
    return new Response('Control-plane UI is not built. Run bun run build in packages/control-plane.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    })
  }
  return new Response(file, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function serveAsset(path: string) {
  const name = path.replace(/^\/assets\//, '')
  if (!name || name.includes('..') || name.includes('/')) return new Response('not found', { status: 404 })
  const filePath = join(distDir, 'assets', name)
  if (!existsSync(filePath)) return new Response('not found', { status: 404 })
  return new Response(Bun.file(filePath))
}

function health() {
  return {
    ok: true,
    workflowHome,
    bun: Bun.version,
    projects: projectIds().length
  }
}

async function readWorktrees(projectId: string, requestUrl: string) {
  const ids = projectId ? [projectId] : projectIds()
  const rows = []
  for (const id of ids) {
    if (!safeSegment(id)) continue
    const tasksDir = join(workflowHome, 'projects', id, 'tasks')
    if (!existsSync(tasksDir)) continue
    const preview = await previewStatus(id, requestUrl)
    for (const task of readdirSync(tasksDir)) {
      if (!safeSegment(task)) continue
      const taskDir = join(tasksDir, task)
      if (!statSync(taskDir).isDirectory()) continue
      for (const entry of worktreeEntries(taskDir)) {
        rows.push(readWorktree(id, task, taskDir, entry, preview))
      }
    }
  }
  return (await Promise.all(rows)).sort((a, b) => `${a.projectId}:${a.task}:${a.worktreeId}`.localeCompare(`${b.projectId}:${b.task}:${b.worktreeId}`))
}

function worktreeEntries(taskDir: string) {
  const legacy = { id: 'default', path: join(taskDir, 'worktree') }
  const entries = existsSync(legacy.path) ? [legacy] : []
  const extraDir = join(taskDir, 'worktrees')
  if (existsSync(extraDir)) {
    for (const id of readdirSync(extraDir)) {
      if (!safeSegment(id)) continue
      const path = join(extraDir, id)
      if (statSync(path).isDirectory()) entries.push({ id, path })
    }
  }
  return entries.length > 0 ? entries : [legacy]
}

async function readWorktree(projectId: string, task: string, taskDir: string, entry: { id: string; path: string }, preview: Record<string, string | boolean | undefined>) {
  const hasWorktree = existsSync(entry.path)
  const worktreePath = hasWorktree ? realpathSync(entry.path) : entry.path
  const branchResult = hasWorktree ? command(['git', '-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD']) : Promise.resolve({ stdout: '', stderr: '', code: 1 })
  const dirtyResult = hasWorktree ? command(['git', '-C', worktreePath, 'status', '--porcelain']) : Promise.resolve({ stdout: '', stderr: '', code: 1 })
  const devResult = devStatus(projectId, task)
  const cleanupResult = cleanupStatus(projectId, task)
  const worktreeCleanupResult = cleanupStatus(projectId, task, entry.id)
  const [branchData, dirtyData, dev, cleanup, worktreeCleanup] = await Promise.all([branchResult, dirtyResult, devResult, cleanupResult, worktreeCleanupResult])
  const branch = branchData.stdout.trim() || null
  const dirty = Boolean(dirtyData.stdout.trim())
  const pr = hasWorktree && branch ? await prStatus(worktreePath, branch) : null
  const repoRoot = hasWorktree ? await mainCheckoutFor(worktreePath) : null
  return {
    projectId,
    task,
    worktreeId: entry.id,
    branch,
    repoRoot,
    worktree: hasWorktree ? worktreePath : null,
    dirty,
    dev,
    preview: {
      ...preview,
      active: Boolean(hasWorktree && preview.worktree === worktreePath)
    },
    pr,
    cleanup,
    worktreeCleanup,
    leases: taskLeases(projectId, task)
  }
}

async function mainCheckoutFor(worktree: string) {
  const result = await command(['git', '-C', worktree, 'worktree', 'list', '--porcelain'])
  if (result.code !== 0) return null
  const blocks = result.stdout.trim().split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n')
    const path = lines.find((line) => line.startsWith('worktree '))?.slice(9)
    const branch = lines.find((line) => line.startsWith('branch '))?.slice(7)
    if (path && branch && /refs\/heads\/(main|master|trunk|develop|dev)$/.test(branch)) return path
  }
  return null
}

async function devStatus(projectId: string, task: string) {
  const result = await command([join(binDir, 'agent-dev'), '--project-id', projectId, 'status', task])
  return {
    ...parseKeyStatus(result.stdout, result.code),
    pid: readText(join(workflowHome, 'projects', projectId, 'tasks', task, 'run', 'dev.pid'))
  }
}

async function previewStatus(projectId: string, requestUrl: string) {
  const result = await command([join(binDir, 'agent-preview'), '--project-id', projectId, 'status'])
  return {
    ok: result.code === 0,
    ...parseKeyStatus(result.stdout, result.code),
    pid: readText(join(workflowHome, 'projects', projectId, 'run', 'preview.pid')),
    previewUrl: previewUrl(projectId, requestUrl)
  }
}

async function cleanupStatus(projectId: string, task: string, worktreeId = '') {
  const args = [join(binDir, 'agent-cleanup'), '--project-id', projectId, '--dry-run']
  if (worktreeId) args.push('--worktree-id', worktreeId)
  args.push(task)
  const result = await command(args)
  const text = (result.stdout || result.stderr).trim()
  return { eligible: text.startsWith(worktreeId ? 'eligible-worktree ' : 'eligible '), text, ok: result.code === 0 }
}

function previewUrl(projectId: string, requestUrl: string) {
  const port = lastNumberAfterLabel(projectId, 'Preview ports')
  if (!port) return undefined
  const url = new URL(requestUrl)
  return `${url.protocol}//${url.hostname}:${port}`
}

function projectFile(projectId: string) {
  return join(workflowHome, 'projects', projectId, 'PROJECT.md')
}

function lastNumberAfterLabel(projectId: string, label: string) {
  const file = projectFile(projectId)
  if (!existsSync(file)) return ''
  const line = readFileSync(file, 'utf8').split('\n').find((value) => value.startsWith(`${label}:`)) || ''
  const numbers = line.replace(`${label}:`, '').match(/\d+/g) || []
  return numbers[numbers.length - 1] || ''
}

function labelValue(projectId: string, label: string) {
  const file = projectFile(projectId)
  if (!existsSync(file)) return ''
  const line = readFileSync(file, 'utf8').split('\n').find((value) => value.startsWith(`${label}:`)) || ''
  return line.replace(`${label}:`, '').trim().split(/\s+/)[0] || ''
}

function taskLeases(projectId: string, task: string) {
  const leasesDir = join(workflowHome, 'projects', projectId, 'leases')
  if (!existsSync(leasesDir)) return []
  const leases = []
  for (const file of readdirSync(leasesDir)) {
    if (!file.endsWith('.json')) continue
    const path = join(leasesDir, file)
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
      if (parsed.task_id !== task) continue
      leases.push({
        resource: String(parsed.resource || file.replace(/\.json$/, '')),
        holderPid: parsed.holder_pid,
        ports: parsed.ports,
        worktree: parsed.worktree,
        acquiredAt: parsed.acquired_at
      })
    } catch {
      continue
    }
  }
  return leases
}

function readText(path: string) {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8').trim()
}

async function prStatus(worktree: string, branch: string) {
  const github = await githubPrStatus(worktree, branch)
  if (github) return github
  return gitlabMrStatus(worktree, branch)
}

async function githubPrStatus(worktree: string, branch: string) {
  if (!which('gh')) return null
  const result = await command(['gh', 'pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,title,state,url,isDraft,statusCheckRollup', '--limit', '1'], { cwd: worktree })
  if (result.code !== 0 || !result.stdout.trim()) return null
  try {
    const parsed = JSON.parse(result.stdout) as unknown[]
    return parsed[0] || null
  } catch {
    return null
  }
}

async function gitlabMrStatus(worktree: string, branch: string) {
  if (!which('glab')) return null
  const result = await command(['glab', 'mr', 'list', '--source-branch', branch, '--all', '--output', 'json'], { cwd: worktree })
  if (result.code !== 0 || !result.stdout.trim()) return null
  try {
    const parsed = JSON.parse(result.stdout) as Array<Record<string, unknown>>
    const mr = parsed[0]
    if (!mr) return null
    return {
      number: mr.iid,
      title: mr.title,
      state: typeof mr.state === 'string' ? mr.state.toUpperCase() : mr.state,
      url: mr.web_url,
      isDraft: mr.draft
    }
  } catch {
    return null
  }
}

async function devAction(task: string, data: JsonValue) {
  const projectId = stringField(data, 'projectId') || stringField(data, 'project_id')
  const action = stringField(data, 'action')
  if (!safeSegment(projectId) || !safeSegment(task)) return jsonError('invalid project or task', 400)
  if (action !== 'up' && action !== 'down') return jsonError('action must be up or down', 400)
  if (action === 'down' && stringField(data, 'confirm') !== 'stop dev') return jsonError('confirmation required', 409)
  const result = await command([join(binDir, 'agent-dev'), '--project-id', projectId, action, task])
  return jsonCommand(result)
}

async function previewAction(data: JsonValue, requestUrl: string) {
  const projectId = stringField(data, 'projectId') || stringField(data, 'project_id')
  const action = stringField(data, 'action')
  const worktree = stringField(data, 'worktree')
  if (!safeSegment(projectId)) return jsonError('invalid project', 400)
  if (action !== 'up' && action !== 'down') return jsonError('action must be up or down', 400)
  if (action === 'down' && stringField(data, 'confirm') !== 'stop preview') return jsonError('confirmation required', 409)
  const args = [join(binDir, 'agent-preview'), '--project-id', projectId]
  if (action === 'up' && worktree) args.push('--worktree', worktree)
  args.push(action)
  const result = await command(args)
  return jsonCommand(result, { previewUrl: previewUrl(projectId, requestUrl) })
}

async function cleanupAction(task: string, data: JsonValue) {
  const projectId = stringField(data, 'projectId') || stringField(data, 'project_id')
  const force = boolField(data, 'force')
  if (!safeSegment(projectId) || !safeSegment(task)) return jsonError('invalid project or task', 400)
  if (stringField(data, 'confirm') !== (force ? task : 'cleanup task')) return jsonError(force ? 'task id confirmation required' : 'confirmation required', 409)
  const args = [join(binDir, 'agent-cleanup'), '--project-id', projectId, '--execute']
  if (force) args.push('--force')
  args.push(task)
  const result = await command(args)
  return jsonCommand(result)
}

async function cleanupWorktreeAction(task: string, worktreeId: string, data: JsonValue) {
  const projectId = stringField(data, 'projectId') || stringField(data, 'project_id')
  const force = boolField(data, 'force')
  if (!safeSegment(projectId) || !safeSegment(task) || !safeSegment(worktreeId)) return jsonError('invalid project, task, or worktree', 400)
  if (stringField(data, 'confirm') !== (force ? worktreeId : 'cleanup worktree')) return jsonError(force ? 'worktree id confirmation required' : 'confirmation required', 409)
  const args = [join(binDir, 'agent-cleanup'), '--project-id', projectId, '--execute', '--worktree-id', worktreeId]
  if (force) args.push('--force')
  args.push(task)
  const result = await command(args)
  return jsonCommand(result)
}

async function reapLeaseAction(data: JsonValue) {
  const projectId = stringField(data, 'projectId') || stringField(data, 'project_id')
  if (!safeSegment(projectId)) return jsonError('invalid project', 400)
  const resource = labelValue(projectId, 'Lease resource')
  if (!resource || !safeSegment(resource)) return jsonError('missing lease resource', 400)
  const result = await command([join(binDir, 'agent-lease'), 'reap', '--project-id', projectId, resource])
  return jsonCommand(result)
}

async function openAction(data: JsonValue) {
  const editor = stringField(data, 'editor')
  const path = stringField(data, 'path')
  const found = installedEditors().find((candidate) => candidate.id === editor)
  if (!found) return jsonError('editor unavailable', 400)
  if (!path || !existsSync(path)) return jsonError('path missing', 400)
  const result = await command([found.command, path])
  return jsonCommand(result)
}

function installedEditors() {
  return [
    { id: 'zed', label: 'Zed', command: 'zed' },
    { id: 'cursor', label: 'Cursor', command: 'cursor' },
    { id: 'code', label: 'VS Code', command: 'code' }
  ].filter((editor) => commandExists(editor.command))
}

function commandExists(name: string) {
  return Bun.spawnSync(['bash', '-lc', `command -v ${name}`]).exitCode === 0
}

function jsonCommand(result: Awaited<ReturnType<typeof command>>, extra: JsonValue = {}) {
  const status = result.code === 0 ? 200 : 409
  return new Response(JSON.stringify({ ok: result.code === 0, code: result.code, stdout: result.stdout, stderr: result.stderr, ...extra }), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

async function command(args: string[], options: { cwd?: string } = {}) {
  const proc = Bun.spawn(args, {
    cwd: options.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, AGENT_WORKFLOW_HOME: workflowHome }
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  return { stdout, stderr, code }
}

function parseKeyStatus(stdout: string, code: number) {
  const parsed: Record<string, string> = {}
  for (const part of stdout.trim().split(/\s+/)) {
    const index = part.indexOf('=')
    if (index > 0) parsed[part.slice(0, index)] = part.slice(index + 1)
  }
  return { ok: code === 0, ...parsed }
}

function projectIds() {
  const projectsDir = join(workflowHome, 'projects')
  if (!existsSync(projectsDir)) return []
  return readdirSync(projectsDir).filter((id) => {
    const path = join(projectsDir, id)
    return safeSegment(id) && statSync(path).isDirectory()
  })
}

function safeSegment(value = '') {
  return Boolean(value) && !value.includes('/') && !value.includes('\\') && value !== '.' && value !== '..'
}

function stringField(data: JsonValue, key: string) {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

function boolField(data: JsonValue, key: string) {
  return data[key] === true
}

function which(name: string) {
  return Bun.spawnSync(['bash', '-lc', `command -v ${name}`]).exitCode === 0
}

function readEnvToken() {
  const path = `${process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`}/agent-workflow/control-plane.env`
  if (!existsSync(path)) return ''
  const match = readFileSync(path, 'utf8').match(/^export AGENT_CP_TOKEN="([^"]+)"$/m)
  return match?.[1] || ''
}

function isAllowedHost(value: string) {
  if (value === 'localhost' || value === '127.0.0.1' || value === '::1') return true
  if (value.startsWith('fd7a:115c:a1e0:')) return true
  const parts = value.split('.').map(Number)
  return parts.length === 4 && parts.every(Number.isInteger) && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
}

export default {
  hostname: host,
  port,
  fetch: app.fetch
}
