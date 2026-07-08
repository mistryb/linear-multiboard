import type { Issue } from '../linear/types'

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function IssueCard({
  issue,
  teamKey,
  teamName,
  workspaceName,
  workspaceLogoUrl,
}: {
  issue: Issue
  teamKey?: string
  teamName?: string
  workspaceName?: string
  workspaceLogoUrl?: string | null
}) {
  return (
    <a className="card" href={issue.url} target="_blank" rel="noreferrer">
      <div className="card-top">
        {(workspaceName || teamName) && (
          <div className="card-source">
            {workspaceName && (
              <div className="card-workspace" title={workspaceName}>
                {workspaceLogoUrl ? (
                  <img className="card-ws-logo" src={workspaceLogoUrl} alt="" />
                ) : (
                  <span className="ws-dot" />
                )}
                {workspaceName}
              </div>
            )}
            {teamName && (
              <span className="card-team" title={teamKey ? `${teamName} (${teamKey})` : teamName}>
                {teamName}
              </span>
            )}
          </div>
        )}
        {issue.priority > 0 && (
          <span className={`prio prio-${issue.priority}`}>{issue.priorityLabel}</span>
        )}
        <span className="card-id">{issue.identifier}</span>
      </div>
      <div className="card-title">{issue.title}</div>
      {issue.labels.length > 0 && (
        <div className="card-meta">
          {issue.labels.map((l) => (
            <span
              key={l.id}
              className="label-chip"
              style={{ borderColor: l.color, color: l.color }}
            >
              <span className="label-dot" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      )}
      {issue.assignee &&
        (() => {
          const who = issue.assignee.name || issue.assignee.email || 'Unassigned'
          return (
            <div className="card-assignee" title={issue.assignee.email ?? who}>
              {issue.assignee.avatarUrl ? (
                <img className="avatar" src={issue.assignee.avatarUrl} alt="" />
              ) : (
                <span className="avatar-fallback">{initials(who)}</span>
              )}
              <span className="assignee-name">{who}</span>
            </div>
          )
        })()}
    </a>
  )
}
