import type { IssuesPayload, Me, PlanInterval, Workspace } from '../shared/types'

// Browser → our server. Auth is a same-origin httpOnly session cookie.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status}).`, res.status)
  return json as T
}

export const api = {
  me: () => request<Me>('GET', '/me'),
  requestLink: (email: string) => request<{ ok: true }>('POST', '/auth/request', { email }),
  verify: (token: string) => request<{ ok: true }>('POST', '/auth/verify', { token }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  workspaces: () => request<Workspace[]>('GET', '/workspaces'),
  addWorkspace: (apiKey: string, label: string) =>
    request<Workspace>('POST', '/workspaces', { apiKey, label }),
  removeWorkspace: (id: string) => request<{ ok: true }>('DELETE', `/workspaces/${id}`),

  cachedIssues: () => request<IssuesPayload>('GET', '/issues'),
  refreshIssues: () => request<IssuesPayload>('POST', '/issues/refresh'),

  checkout: (interval: PlanInterval) => request<{ url: string }>('POST', '/billing/checkout', { interval }),
  portal: () => request<{ url: string }>('POST', '/billing/portal'),
}
