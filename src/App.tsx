import { useEffect, useState } from 'react'
import type { Workspace } from './linear/types'
import { ConfigMissingError, loadConfig } from './linear/config'
import { fetchOrganization } from './linear/api'
import { useAllIssues } from './hooks/useAllIssues'
import { SetupScreen } from './components/SetupScreen'
import { IssueBoard } from './components/IssueBoard'

// The "All Issues" board tab uses this sentinel instead of an org id.
const ALL_TAB = 'all'

interface LoadError {
  label: string
  message: string
}

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [busy, setBusy] = useState(true)
  const [loadErrors, setLoadErrors] = useState<LoadError[]>([])
  const [setupHint, setSetupHint] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Read public/linear.config.json and resolve each API key to its workspace.
  useEffect(() => {
    let alive = true
    setBusy(true)
    setSetupHint(null)
    ;(async () => {
      try {
        const entries = await loadConfig()
        if (!alive) return
        if (entries.length === 0) {
          setSetupHint(null)
          setWorkspaces([])
          return
        }

        const loaded: Workspace[] = []
        const errors: LoadError[] = []
        // Sequential is fine — you have a handful of workspaces, not hundreds.
        for (const entry of entries) {
          const label = entry.label ?? `key …${entry.apiKey.slice(-6)}`
          try {
            const organization = await fetchOrganization(entry.apiKey)
            loaded.push({ apiKey: entry.apiKey, label: entry.label, organization })
          } catch (e) {
            errors.push({ label, message: String((e as Error).message ?? e) })
          }
        }
        if (!alive) return
        setWorkspaces(loaded)
        setLoadErrors(errors)
      } catch (e) {
        if (!alive) return
        if (e instanceof ConfigMissingError) {
          setWorkspaces([])
          setSetupHint(null)
        } else {
          setWorkspaces([])
          setSetupHint(String((e as Error).message ?? e))
        }
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [reloadKey])

  // If the selected workspace tab vanished after a config reload, fall back to All.
  useEffect(() => {
    if (activeTab !== ALL_TAB && !workspaces.some((w) => w.organization.id === activeTab)) {
      setActiveTab(ALL_TAB)
    }
  }, [workspaces, activeTab])

  // All issues from every workspace, loaded once. Each board filters this.
  const { issues, loading, errors, lastRefreshed, refresh } = useAllIssues(workspaces)

  const active = workspaces.find((w) => w.organization.id === activeTab) ?? null
  const boardIssues =
    activeTab === ALL_TAB ? issues : issues.filter((i) => i.workspaceId === activeTab)
  const boardErrors =
    activeTab === ALL_TAB || !active
      ? errors
      : errors.filter((e) => e.startsWith(`${active.organization.name}:`))

  if (busy) {
    return (
      <div className="app">
        <div className="center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          <span className="brand-badge" />
          MultiBoard
        </span>

        <div className="ws-tabs">
          {workspaces.length > 0 && (
            <button
              className={`ws-tab ${activeTab === ALL_TAB ? 'active' : ''}`}
              onClick={() => setActiveTab(ALL_TAB)}
              title="All active issues across every workspace"
            >
              <span className="ws-logo" />
              All Issues
            </button>
          )}
          {workspaces.map((w) => (
            <button
              key={w.organization.id}
              className={`ws-tab ${w.organization.id === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(w.organization.id)}
              title="Click to view"
            >
              {w.organization.logoUrl ? (
                <img className="ws-logo" src={w.organization.logoUrl} alt="" />
              ) : (
                <span className="ws-logo" />
              )}
              {w.organization.name}
            </button>
          ))}
        </div>

        <button
          className="btn btn-ghost"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Re-read public/linear.config.json"
        >
          Reload config
        </button>
      </div>

      {loadErrors.length > 0 && (
        <div className="error-banner">
          <span>
            Couldn&apos;t load {loadErrors.length} workspace
            {loadErrors.length > 1 ? 's' : ''}:{' '}
            {loadErrors.map((e) => `${e.label} (${e.message})`).join('; ')}
          </span>
          <button className="btn" onClick={() => setLoadErrors([])}>
            Dismiss
          </button>
        </div>
      )}

      {workspaces.length === 0 ? (
        <SetupScreen detail={setupHint ?? undefined} />
      ) : activeTab === ALL_TAB ? (
        <IssueBoard
          title="All workspaces · active issues"
          issues={boardIssues}
          loading={loading}
          errors={boardErrors}
          lastRefreshed={lastRefreshed}
          onRefresh={refresh}
          showWorkspace
        />
      ) : active ? (
        <IssueBoard
          title={active.organization.name}
          issues={boardIssues}
          loading={loading}
          errors={boardErrors}
          lastRefreshed={lastRefreshed}
          onRefresh={refresh}
          showWorkspace={false}
        />
      ) : null}
    </div>
  )
}
