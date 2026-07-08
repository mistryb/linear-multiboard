import type { Issue, Organization, StateType } from './types'

// Thin GraphQL client. In dev, /graphql is proxied to https://api.linear.app.
const GRAPHQL_URL = import.meta.env.DEV ? '/graphql' : 'https://api.linear.app/graphql'

async function gql<T>(apiKey: string, query: string, variables?: unknown): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Linear personal API keys are passed raw, with NO "Bearer " prefix.
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 401) {
    throw new Error('Unauthorized — this workspace API key is invalid or revoked.')
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }
  if (!json.data) throw new Error('Empty response from Linear API.')
  return json.data
}

/** Fetch the organization an API key belongs to (used to name each workspace). */
export async function fetchOrganization(apiKey: string): Promise<Organization> {
  const data = await gql<{ organization: Organization }>(
    apiKey,
    `query { organization { id name urlKey logoUrl } }`,
  )
  return data.organization
}

interface RawIssue {
  id: string
  identifier: string
  title: string
  priority: number
  priorityLabel: string
  url: string
  updatedAt: string
  state: { id: string } | null
  assignee: { id: string; name: string; email: string | null; avatarUrl: string | null } | null
  labels: { nodes: { id: string; name: string; color: string }[] }
}

export interface ActiveIssue extends Issue {
  stateType: StateType
  stateName: string
  teamKey: string
  teamName: string
}

// Only these state types show on a board — this drops Done (completed) and
// Canceled (which is also the type Linear gives "Duplicate").
const ACTIVE_STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started']

interface RawActiveIssue extends Omit<RawIssue, 'state'> {
  state: { id: string; name: string; type: StateType } | null
  team: { key: string; name: string } | null
}

/**
 * Every active (non-done, non-canceled, non-duplicate) issue across the whole
 * workspace — every team's issues, in one query (the top-level `issues`
 * connection isn't scoped to a team). Each board is a client-side view over
 * this. The state-type filter runs server-side; `first`/`labels` stay modest to
 * keep the query under Linear's complexity limit. Most-recently-updated first.
 */
export async function fetchActiveIssues(apiKey: string): Promise<ActiveIssue[]> {
  const data = await gql<{ issues: { nodes: RawActiveIssue[] } }>(
    apiKey,
    `query ActiveIssues($types: [String!]!) {
      issues(
        first: 200
        orderBy: updatedAt
        filter: { state: { type: { in: $types } } }
      ) {
        nodes {
          id
          identifier
          title
          priority
          priorityLabel
          url
          updatedAt
          state { id name type }
          team { key name }
          assignee { id name email avatarUrl }
          labels(first: 10) { nodes { id name color } }
        }
      }
    }`,
    { types: ACTIVE_STATE_TYPES },
  )

  return data.issues.nodes
    // Belt-and-suspenders: exclude any workspace that names a "Duplicate" state
    // with a non-canceled type, which the server filter wouldn't catch.
    .filter((n) => n.state && n.state.name.toLowerCase() !== 'duplicate')
    .map((n) => ({
      id: n.id,
      identifier: n.identifier,
      title: n.title,
      priority: n.priority,
      priorityLabel: n.priorityLabel,
      url: n.url,
      updatedAt: n.updatedAt,
      stateId: n.state?.id ?? '',
      stateType: n.state?.type ?? 'backlog',
      stateName: n.state?.name ?? '',
      teamKey: n.team?.key ?? '',
      teamName: n.team?.name ?? '',
      assignee: n.assignee,
      labels: n.labels.nodes,
    }))
}
