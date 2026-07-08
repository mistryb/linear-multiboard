// Shapes returned by the Linear GraphQL API (only the fields this app reads).

export interface Organization {
  id: string
  name: string
  urlKey: string
  logoUrl: string | null
}

export type StateType =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled'

export interface WorkflowState {
  id: string
  name: string
  type: StateType
  color: string
  position: number
}

export interface Team {
  id: string
  name: string
  key: string
}

export interface User {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Issue {
  id: string
  identifier: string
  title: string
  priority: number
  priorityLabel: string
  url: string
  updatedAt: string
  stateId: string
  assignee: User | null
  labels: Label[]
}

// One entry in public/linear.config.json: a personal API key for a workspace,
// plus an optional human label used only in error messages.
export interface WorkspaceConfig {
  apiKey: string
  label?: string
}

// A loaded workspace = one API key + the org it unlocked.
export interface Workspace {
  apiKey: string
  label?: string
  organization: Organization
}

// An issue as shown on a board: the raw issue, its state type (for grouping into
// columns), and which workspace it came from. Every board — the combined one and
// each per-workspace one — is a view over a single BoardIssue[] fetched once.
export interface BoardIssue extends Issue {
  stateType: StateType
  stateName: string
  teamKey: string
  teamName: string
  workspaceId: string
  workspaceName: string
  workspaceLogoUrl: string | null
}
