import { useMemo } from 'react'
import type { BoardIssue, StateType } from '../linear/types'
import { IssueCard } from './IssueCard'
import { LastRefreshed } from './LastRefreshed'

// The combined board and every per-workspace board share these columns, grouped
// by state *type* (state IDs differ per workspace/team). Done / Canceled /
// Duplicate are already filtered out upstream in fetchActiveIssues.
const COLUMNS: { type: StateType; name: string; color: string }[] = [
  { type: 'triage', name: 'Triage', color: '#eb5757' },
  { type: 'backlog', name: 'Backlog', color: '#95a2b3' },
  { type: 'unstarted', name: 'Todo', color: '#5e6ad2' },
  { type: 'started', name: 'In Progress', color: '#f2c94c' },
]

// Linear priority: 1 Urgent → 4 Low, and 0 = "No priority" (sorts last).
function priorityRank(p: number): number {
  return p === 0 ? 99 : p
}

export function IssueBoard({
  title,
  issues,
  loading,
  errors,
  lastRefreshed,
  onRefresh,
  showWorkspace = true,
}: {
  title: string
  issues: BoardIssue[]
  loading: boolean
  errors: string[]
  lastRefreshed: number | null
  onRefresh: () => void
  showWorkspace?: boolean
}) {
  const columns = useMemo(() => {
    const byType = new Map<StateType, BoardIssue[]>()
    for (const it of issues) {
      const list = byType.get(it.stateType) ?? []
      list.push(it)
      byType.set(it.stateType, list)
    }
    for (const list of byType.values()) {
      list.sort((a, b) => {
        const p = priorityRank(a.priority) - priorityRank(b.priority)
        return p !== 0 ? p : b.updatedAt.localeCompare(a.updatedAt)
      })
    }
    return COLUMNS.map((c) => ({ ...c, issues: byType.get(c.type) ?? [] }))
  }, [issues])

  return (
    <div className="app" style={{ height: '100%' }}>
      <div className="ws-toolbar">
        <label className="faint">{title}</label>
        <div className="spacer" />
        {loading && <div className="spinner" />}
        <span className="faint">{issues.length} issues</span>
        <LastRefreshed at={lastRefreshed} />
        <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <div className="error-banner">
          <span>{errors.join(' · ')}</span>
        </div>
      )}

      <div className="board">
        {columns.map((col) => (
          <div className="column" key={col.type}>
            <div className="column-header">
              <span className="state-dot" style={{ background: col.color }} />
              {col.name}
              <span className="count-pill">{col.issues.length}</span>
            </div>
            <div className="column-body">
              {col.issues.length === 0 ? (
                <div className="empty-col">No issues</div>
              ) : (
                col.issues.map((it) => (
                  <IssueCard
                    key={it.id}
                    issue={it}
                    teamKey={it.teamKey}
                    teamName={it.teamName}
                    workspaceName={showWorkspace ? it.workspaceName : undefined}
                    workspaceLogoUrl={showWorkspace ? it.workspaceLogoUrl : undefined}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
