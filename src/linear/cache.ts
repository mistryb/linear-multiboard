// Best-effort local disk cache for the MultiBoard, so the board renders
// instantly from the last-loaded issues and then refreshes from the API.
// Backed by a small Vite dev-server middleware (see vite.config.ts) that
// reads/writes data/issues.json. In a production build there's no middleware,
// so these calls simply resolve to "no cache" / no-op.

const CACHE_URL = '/api/issues-cache'

export interface IssuesCache<T> {
  savedAt: number
  issues: T[]
}

export async function loadIssuesCache<T>(): Promise<IssuesCache<T> | null> {
  try {
    const res = await fetch(CACHE_URL, { cache: 'no-store' })
    if (res.status === 204 || !res.ok) return null
    const json = (await res.json()) as IssuesCache<T>
    return json && Array.isArray(json.issues) ? json : null
  } catch {
    return null
  }
}

export async function saveIssuesCache<T>(issues: T[]): Promise<void> {
  try {
    await fetch(CACHE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ savedAt: Date.now(), issues } satisfies IssuesCache<T>),
    })
  } catch {
    // Caching is best-effort; failures (e.g. production build) are ignored.
  }
}
