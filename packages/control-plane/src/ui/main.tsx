import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import './styles.css'

type DevStatus = {
  ok?: boolean
  state?: string
  ports?: string
  pid?: string
}

type CleanupStatus = {
  eligible?: boolean
  text?: string
  ok?: boolean
}

type PreviewStatus = {
  ok?: boolean
  state?: string
  ports?: string
  pid?: string
  worktree?: string
  previewUrl?: string
  active?: boolean
}

type PullRequest = {
  number?: number
  title?: string
  state?: string
  url?: string
  isDraft?: boolean
}

type Worktree = {
  projectId: string
  task: string
  worktreeId: string
  branch: string | null
  repoRoot: string | null
  worktree: string | null
  dirty: boolean
  dev: DevStatus
  preview: PreviewStatus
  cleanup: CleanupStatus
  worktreeCleanup: CleanupStatus
  pr: PullRequest | null
  leases: Lease[]
}

type Lease = {
  resource?: string
  holderPid?: number | string
  ports?: number[] | string
  worktree?: string
  acquiredAt?: string
}

type Editor = {
  id: string
  label: string
}

type Toast = {
  tone: 'good' | 'bad' | 'info'
  text: string
  href?: string
}

type TaskGroupData = {
  task: string
  rows: Worktree[]
}

type ProjectGroupData = {
  projectId: string
  repoRoot: string | null
  tasks: TaskGroupData[]
}

const tokenKey = 'agent_cp_token'

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || '')
  const [draftToken, setDraftToken] = useState('')
  const [projectId, setProjectId] = useState('')
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [editors, setEditors] = useState<Editor[]>([])
  const [editorId, setEditorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)

  const projects = useMemo(() => [...new Set(worktrees.map((row) => row.projectId))], [worktrees])
  const visibleRows = projectId ? worktrees.filter((row) => row.projectId === projectId) : worktrees
  const livePreviewRows = worktrees.filter((row) => row.preview.active)
  const grouped = useMemo(() => groupRows(visibleRows), [visibleRows])
  const archiveReadyTasks = useMemo(() => new Set(worktrees.filter((row) => row.cleanup.eligible).map((row) => `${row.projectId}:${row.task}`)).size, [worktrees])

  useEffect(() => {
    if (token) {
      void loadEditors()
      void load()
    }
  }, [token])

  async function api<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(path, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...init.headers
      }
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || data.stderr || data.stdout || response.statusText)
    }
    return data as T
  }

  async function load() {
    setLoading(true)
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
      const data = await api<{ worktrees: Worktree[] }>(`/api/worktrees${query}`)
      setWorktrees(data.worktrees)
      setLastLoadedAt(new Date().toLocaleTimeString())
      setToast(null)
    } catch (error) {
      setToast({ tone: 'bad', text: error instanceof Error ? error.message : 'Load failed' })
    } finally {
      setLoading(false)
    }
  }

  async function loadEditors() {
    try {
      const data = await api<{ editors: Editor[] }>('/api/editors')
      setEditors(data.editors)
      setEditorId((current) => current || data.editors[0]?.id || '')
    } catch {
      setEditors([])
    }
  }

  function unlock() {
    sessionStorage.setItem(tokenKey, draftToken)
    setToken(draftToken)
  }

  function lock() {
    sessionStorage.removeItem(tokenKey)
    setToken('')
    setWorktrees([])
  }

  async function archiveTask(row: Worktree, force = false, confirmation = '') {
    await mutate(
      `/api/worktrees/${encodeURIComponent(row.task)}/cleanup`,
      { projectId: row.projectId, force, confirm: force ? confirmation : 'cleanup task' },
      force ? 'Task force archived' : 'Task archived'
    )
  }

  async function cleanupWorktree(row: Worktree, force = false, confirmation = '') {
    await mutate(
      `/api/worktrees/${encodeURIComponent(row.task)}/worktrees/${encodeURIComponent(row.worktreeId)}/cleanup`,
      { projectId: row.projectId, force, confirm: force ? confirmation : 'cleanup worktree' },
      force ? 'Worktree force cleaned' : 'Worktree cleaned'
    )
  }

  async function stopAgent(row: Worktree) {
    await mutate(`/api/worktrees/${encodeURIComponent(row.task)}/dev`, { projectId: row.projectId, action: 'down', confirm: 'stop dev' }, 'Agent lane stopped')
  }

  async function reapLease(project: string) {
    await mutate('/api/leases/reap', { projectId: project }, 'Stale lease reap checked')
  }

  async function openPath(path: string | null | undefined) {
    if (!path) return
    if (!editorId) {
      setToast({ tone: 'bad', text: 'No supported editor CLI found' })
      return
    }
    await mutate('/api/open', { editor: editorId, path }, 'Opened editor')
  }

  async function preview(row: Worktree, action: 'up' | 'down') {
    if (!row.worktree) {
      setToast({ tone: 'bad', text: 'This task has no worktree to preview' })
      return
    }
    const body: Record<string, string> = { projectId: row.projectId, action }
    if (action === 'up') body.worktree = row.worktree
    if (action === 'down') body.confirm = 'stop preview'
    try {
      const data = await api<{ previewUrl?: string; stdout?: string }>(`/api/preview`, {
        method: 'POST',
        body: JSON.stringify(body)
      })
      setToast({
        tone: 'good',
        text: action === 'up' ? `Previewing ${row.task}` : 'Preview stopped',
        href: data.previewUrl
      })
      await load()
    } catch (error) {
      setToast({ tone: 'bad', text: error instanceof Error ? error.message : 'Preview failed' })
    }
  }

  async function mutate(path: string, body: Record<string, string | boolean>, message: string) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) })
      setToast({ tone: 'good', text: message })
      await load()
    } catch (error) {
      setToast({ tone: 'bad', text: error instanceof Error ? error.message : 'Action failed' })
    }
  }

  if (!token) {
    return (
      <main className="login">
        <section className="loginPanel">
          <p className="eyebrow">local control plane</p>
          <h1>Agent Workflow</h1>
          <input
            autoComplete="current-password"
            onChange={(event) => setDraftToken(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && unlock()}
            placeholder="Token"
            type="password"
            value={draftToken}
          />
          <button className="primary" onClick={unlock}>Unlock</button>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">control plane</p>
          <h1>Agent Workflow</h1>
        </div>
        <button onClick={lock}>Lock</button>
      </header>

      <section className="controls">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">All projects</option>
          {projects.map((project) => <option key={project} value={project}>{project}</option>)}
        </select>
        <select value={editorId} onChange={(event) => setEditorId(event.target.value)}>
          {editors.length === 0 ? <option value="">No editor CLI</option> : editors.map((editor) => <option key={editor.id} value={editor.id}>{editor.label}</option>)}
        </select>
        <button onClick={load}>{loading ? 'Refreshing' : 'Refresh'}</button>
        <span className="refreshMeta">{lastLoadedAt ? `Updated ${lastLoadedAt}` : 'Not refreshed'}</span>
      </section>

      {toast && (
        <section className={`toast ${toast.tone}`}>
          <span>{toast.text}</span>
          {toast.href && <a href={toast.href} target="_blank" rel="noreferrer">Open preview</a>}
        </section>
      )}

      <section className="summary">
        <Metric label="Projects" value={projects.length || '-'} />
        <Metric label="Worktrees" value={worktrees.length || '-'} />
        <Metric label="Live preview" value={livePreviewRows[0]?.task || '-'} />
        <Metric label="Archive-ready" value={archiveReadyTasks || '-'} />
      </section>

      {loading && worktrees.length === 0 ? (
        <section className="empty">
          <h2>Loading worktrees</h2>
          <p>Deriving state from task folders, git, and local CLIs.</p>
        </section>
      ) : visibleRows.length === 0 ? (
        <section className="empty">
          <h2>No task worktrees</h2>
          <p>{projectId ? 'No rows for selected project.' : 'Create or select a task worktree, then refresh.'}</p>
        </section>
      ) : (
        <section className="projects">
          {grouped.map((project) => (
            <ProjectGroup
              key={project.projectId}
              project={project}
              onArchive={archiveTask}
              onCleanupWorktree={cleanupWorktree}
              onOpen={openPath}
              onPreview={preview}
              onReap={reapLease}
              onStopAgent={stopAgent}
            />
          ))}
        </section>
      )}
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ProjectGroup({
  project,
  onArchive,
  onCleanupWorktree,
  onOpen,
  onPreview,
  onReap,
  onStopAgent
}: {
  project: ProjectGroupData
  onArchive: (row: Worktree, force?: boolean, confirmation?: string) => void
  onCleanupWorktree: (row: Worktree, force?: boolean, confirmation?: string) => void
  onOpen: (path: string | null | undefined) => void
  onPreview: (row: Worktree, action: 'up' | 'down') => void
  onReap: (projectId: string) => void
  onStopAgent: (row: Worktree) => void
}) {
  return (
    <section className="projectGroup">
      <header className="projectHeader">
        <div>
          <h2>{project.projectId}</h2>
          <p>{project.tasks.length} task{project.tasks.length === 1 ? '' : 's'} / {project.tasks.reduce((count, task) => count + task.rows.length, 0)} worktree{project.tasks.reduce((count, task) => count + task.rows.length, 0) === 1 ? '' : 's'}</p>
        </div>
        <div className="actions">
          <button disabled={!project.repoRoot} onClick={() => onOpen(project.repoRoot)}>Open Repo</button>
          <button className="quiet" onClick={() => onReap(project.projectId)}>Reap Stale Lease</button>
        </div>
      </header>
      <div className="taskList">
        {project.tasks.map((task) => (
          <TaskGroup
            key={task.task}
            task={task}
            onArchive={onArchive}
            onCleanupWorktree={onCleanupWorktree}
            onOpen={onOpen}
            onPreview={onPreview}
            onStopAgent={onStopAgent}
          />
        ))}
      </div>
    </section>
  )
}

function TaskGroup({
  task,
  onArchive,
  onCleanupWorktree,
  onOpen,
  onPreview,
  onStopAgent
}: {
  task: TaskGroupData
  onArchive: (row: Worktree, force?: boolean, confirmation?: string) => void
  onCleanupWorktree: (row: Worktree, force?: boolean, confirmation?: string) => void
  onOpen: (path: string | null | undefined) => void
  onPreview: (row: Worktree, action: 'up' | 'down') => void
  onStopAgent: (row: Worktree) => void
}) {
  const [confirm, setConfirm] = useState<'' | 'archive' | 'force-archive' | 'agent'>('')
  const first = task.rows[0]
  const agentRow = task.rows.find((row) => row.dev.state === 'running') || null

  function archive() {
    if (confirm !== 'archive') {
      setConfirm('archive')
      return
    }
    setConfirm('')
    onArchive(first)
  }

  function forceArchive() {
    const typed = window.prompt(`Type ${first.task} to force archive this task`)
    if (typed === null) return
    onArchive(first, true, typed.trim())
  }

  function stopAgent() {
    if (!agentRow) return
    if (confirm !== 'agent') {
      setConfirm('agent')
      return
    }
    setConfirm('')
    onStopAgent(agentRow)
  }

  return (
    <article className="taskGroup">
      <header className="taskHeader">
        <div>
          <p className="task">{task.task}</p>
          <p className="path">{task.rows.length} worktree{task.rows.length === 1 ? '' : 's'} / archive {first.cleanup.eligible ? 'eligible' : 'blocked'}</p>
        </div>
        <div className="actions">
          <span className={`status ${agentRow ? 'live' : ''}`}>{agentRow ? 'agent running' : 'agent idle'}</span>
          {agentRow && <button className="danger" onClick={stopAgent}>{confirm === 'agent' ? 'Confirm Stop Agent' : 'Stop Agent'}</button>}
          {first.cleanup.eligible ? (
            <button className="danger quiet" onClick={archive}>{confirm === 'archive' ? 'Confirm Archive' : 'Archive Task'}</button>
          ) : (
            <button className="danger" onClick={forceArchive}>Force Archive</button>
          )}
        </div>
      </header>
      {confirm && <p className="confirmHint">Click confirm to continue.</p>}
      {first.cleanup.text && <p className="note">{first.cleanup.text}</p>}
      <RuntimeDetails row={first} />
      <div className="worktreeList">
        {task.rows.map((row) => (
          <WorktreeRow
            key={row.worktreeId}
            row={row}
            onCleanup={onCleanupWorktree}
            onOpen={onOpen}
            onPreview={onPreview}
          />
        ))}
      </div>
    </article>
  )
}

function WorktreeRow({
  row,
  onCleanup,
  onOpen,
  onPreview
}: {
  row: Worktree
  onCleanup: (row: Worktree, force?: boolean, confirmation?: string) => void
  onOpen: (path: string | null | undefined) => void
  onPreview: (row: Worktree, action: 'up' | 'down') => void
}) {
  const [confirm, setConfirm] = useState<'' | 'stop-preview' | 'cleanup' | 'force-cleanup'>('')
  const previewLive = row.preview.active
  const previewElsewhere = Boolean(row.preview.worktree && !previewLive)

  function stopPreview() {
    if (confirm !== 'stop-preview') {
      setConfirm('stop-preview')
      return
    }
    setConfirm('')
    onPreview(row, 'down')
  }

  function cleanup(force = false) {
    if (force) {
      const typed = window.prompt(`Type ${row.worktreeId} to force cleanup this worktree`)
      if (typed === null) return
      onCleanup(row, true, typed.trim())
      return
    }
    const next = force ? 'force-cleanup' : 'cleanup'
    if (confirm !== next) {
      setConfirm(next)
      return
    }
    setConfirm('')
    onCleanup(row, force)
  }

  return (
    <article className={previewLive ? 'row previewLive' : 'row'}>
      <header>
        <div>
          <p className="task">{row.worktreeId}</p>
          <p className="path">{row.worktree || 'missing worktree'}</p>
        </div>
        <span className={`status ${previewLive ? 'live' : ''}`}>{previewLive ? 'preview live' : 'idle'}</span>
      </header>
      <div className="details">
        <Field label="Branch" value={row.branch || 'missing'} warn={row.dirty} />
        <Field label="Preview" value={previewLive ? row.preview.previewUrl || 'running' : previewElsewhere ? 'running elsewhere' : 'stopped'} warn={previewElsewhere} />
        <Field label="PR" value={row.pr ? `#${row.pr.number} ${row.pr.state}` : 'none'} href={row.pr?.url} />
        <Field label="Cleanup" value={row.worktreeCleanup.eligible ? 'eligible' : 'blocked'} warn={!row.worktreeCleanup.eligible} />
      </div>
      <div className="actions primaryActions">
        <button className="primary" disabled={!row.worktree} onClick={() => onPreview(row, 'up')}>{previewLive ? 'Restart Preview' : 'Start Preview'}</button>
        {previewLive && row.preview.previewUrl && <a className="buttonLike open" href={row.preview.previewUrl} target="_blank" rel="noreferrer">Open Preview</a>}
        {previewLive && <button className="danger" onClick={stopPreview}>{confirm === 'stop-preview' ? 'Confirm Stop' : 'Stop Preview'}</button>}
        <button disabled={!row.worktree} onClick={() => onOpen(row.worktree)}>Open Worktree</button>
        {row.worktree && row.worktreeCleanup.eligible && <button className="danger quiet" onClick={() => cleanup(false)}>{confirm === 'cleanup' ? 'Confirm Cleanup' : 'Cleanup Worktree'}</button>}
        {row.worktree && !row.worktreeCleanup.eligible && <button className="danger" onClick={() => cleanup(true)}>Force Cleanup</button>}
      </div>
      {confirm && <p className="confirmHint">Click confirm to continue.</p>}
      {row.worktreeCleanup.text && <p className="note">{row.worktreeCleanup.text}</p>}
    </article>
  )
}

function Field({ label, value, warn = false, href }: { label: string; value: string; warn?: boolean; href?: string }) {
  return (
    <div className={warn ? 'field warn' : 'field'}>
      <span>{label}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : <strong>{value}</strong>}
    </div>
  )
}

function RuntimeDetails({ row }: { row: Worktree }) {
  return (
    <details className="runtimeDetails">
      <summary>Runtime details</summary>
      <dl>
        <Detail label="Agent state" value={row.dev.state || 'unknown'} />
        <Detail label="Agent pid" value={row.dev.pid || '-'} />
        <Detail label="Agent ports" value={row.dev.ports || '-'} />
        <Detail label="Preview state" value={row.preview.state || 'unknown'} />
        <Detail label="Preview pid" value={row.preview.pid || '-'} />
        <Detail label="Preview worktree" value={row.preview.worktree || '-'} />
        <Detail label="Preview ports" value={row.preview.ports || '-'} />
        {row.leases.length === 0 ? (
          <Detail label="Lease" value="none" />
        ) : row.leases.map((lease) => (
          <Detail
            key={`${lease.resource || 'lease'}:${lease.holderPid || ''}`}
            label={`Lease ${lease.resource || ''}`.trim()}
            value={`pid ${lease.holderPid || '-'} / ports ${formatPorts(lease.ports)} / ${lease.worktree || '-'}${lease.acquiredAt ? ` / ${lease.acquiredAt}` : ''}`}
          />
        ))}
      </dl>
    </details>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

function formatPorts(value: number[] | string | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  return value || '-'
}

function groupRows(rows: Worktree[]) {
  const byProject = new Map<string, ProjectGroupData>()
  for (const row of rows) {
    let project = byProject.get(row.projectId)
    if (!project) {
      project = { projectId: row.projectId, repoRoot: row.repoRoot, tasks: [] }
      byProject.set(row.projectId, project)
    }
    project.repoRoot ||= row.repoRoot
    let task = project.tasks.find((candidate) => candidate.task === row.task)
    if (!task) {
      task = { task: row.task, rows: [] }
      project.tasks.push(task)
    }
    task.rows.push(row)
  }
  return [...byProject.values()].map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => ({
      ...task,
      rows: task.rows.sort((a, b) => a.worktreeId.localeCompare(b.worktreeId))
    }))
  }))
}

createRoot(document.getElementById('root')!).render(<App />)
