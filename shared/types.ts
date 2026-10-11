// Types shared by the server (server/) and the browser app (src/).

// ---- Linear API shapes (only the fields this app reads) ----

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

export interface ActiveIssue extends Issue {
  stateType: StateType
  stateName: string
  teamKey: string
  teamName: string
}

// An issue as shown on a board: the raw issue, its state type (for grouping into
// columns), and which workspace it came from. Every board — the combined one and
// each per-workspace one — is a view over a single BoardIssue[] fetched once.
export interface BoardIssue extends ActiveIssue {
  workspaceId: string
  workspaceName: string
  workspaceLogoUrl: string | null
}

// ---- App API shapes ----

// A Linear workspace connected to an account. The API key never leaves the
// server; the browser only sees which org it unlocked.
export interface Workspace {
  id: string
  label: string | null
  keyHint: string
  organization: Organization
}

export type PlanInterval = 'month' | 'year'

export interface Plan {
  interval: PlanInterval
  // Smallest currency unit (cents), as Stripe reports it.
  amount: number
  currency: string
}

export interface Billing {
  // False on self-hosted installs without Stripe configured — everything is unlocked.
  enabled: boolean
  // Whether the account can use the board right now (subscribed, trialing, or billing off).
  hasAccess: boolean
  status: string | null
  trialEndsAt: string | null
  // Prices offered at checkout (empty when billing is off).
  plans: Plan[]
}

export interface Me {
  email: string
  billing: Billing
}

export interface IssuesPayload {
  // null from a refresh where every workspace failed — keep showing what you have.
  issues: BoardIssue[] | null
  errors: string[]
  refreshedAt: number | null
}
