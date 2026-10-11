import { Hono } from 'hono'
import type { BoardIssue, IssuesPayload, Workspace } from '../shared/types'
import { requireUser, type AuthEnv } from './auth'
import { billingFor, requireAccess } from './billing'
import { decrypt, encrypt } from './crypto'
import { sql } from './db'
import { fetchActiveIssues, fetchOrganization } from './linear'

// Every query here is scoped by c.get('user').id — that's the tenant boundary.

interface WorkspaceRow {
  id: string
  label: string | null
  key_hint: string
  api_key_encrypted: string
  org_id: string
  org_name: string
  org_url_key: string
  org_logo_url: string | null
}

function toWorkspace(r: WorkspaceRow): Workspace {
  return {
    id: r.id,
    label: r.label,
    keyHint: r.key_hint,
    organization: { id: r.org_id, name: r.org_name, urlKey: r.org_url_key, logoUrl: r.org_logo_url },
  }
}

export const appRoutes = new Hono<AuthEnv>()

appRoutes.use('*', requireUser)

appRoutes.get('/me', async (c) => {
  const user = c.get('user')
  return c.json({ email: user.email, billing: await billingFor(user) })
})

appRoutes.get('/workspaces', async (c) => {
  const rows = await sql<WorkspaceRow[]>`
    SELECT * FROM workspaces WHERE user_id = ${c.get('user').id} ORDER BY created_at`
  return c.json(rows.map(toWorkspace))
})

// Connect a workspace: verify the key against Linear, then store it encrypted.
appRoutes.post('/workspaces', async (c) => {
  const body = await c.req
    .json<{ apiKey?: unknown; label?: unknown }>()
    .catch(() => ({}) as { apiKey?: unknown; label?: unknown })
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : null
  if (!apiKey.startsWith('lin_api_') || apiKey.length > 200) {
    return c.json({ error: 'That doesn’t look like a Linear personal API key (they start with lin_api_).' }, 400)
  }

  let org
  try {
    org = await fetchOrganization(apiKey)
  } catch (e) {
    return c.json({ error: `Linear rejected this key: ${(e as Error).message}` }, 400)
  }

  // Re-adding a key for an already-connected org replaces the old key.
  const [row] = await sql<WorkspaceRow[]>`
    INSERT INTO workspaces (user_id, label, api_key_encrypted, key_hint, org_id, org_name, org_url_key, org_logo_url)
    VALUES (${c.get('user').id}, ${label}, ${encrypt(apiKey)}, ${apiKey.slice(-4)},
            ${org.id}, ${org.name}, ${org.urlKey}, ${org.logoUrl})
    ON CONFLICT (user_id, org_id) DO UPDATE SET
      label = EXCLUDED.label, api_key_encrypted = EXCLUDED.api_key_encrypted, key_hint = EXCLUDED.key_hint,
      org_name = EXCLUDED.org_name, org_url_key = EXCLUDED.org_url_key, org_logo_url = EXCLUDED.org_logo_url
    RETURNING *`
  return c.json(toWorkspace(row), 201)
})

appRoutes.delete('/workspaces/:id', async (c) => {
  const id = c.req.param('id')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Not found.' }, 404)
  const result = await sql`DELETE FROM workspaces WHERE id = ${id} AND user_id = ${c.get('user').id}`
  if (result.count === 0) return c.json({ error: 'Not found.' }, 404)
  return c.json({ ok: true })
})

// The last-fetched board, so the UI can paint instantly before refreshing.
appRoutes.get('/issues', requireAccess, async (c) => {
  const [row] = await sql<{ payload: BoardIssue[]; refreshed_at: Date }[]>`
    SELECT payload, refreshed_at FROM issue_cache WHERE user_id = ${c.get('user').id}`
  const body: IssuesPayload = row
    ? { issues: row.payload, errors: [], refreshedAt: row.refreshed_at.getTime() }
    : { issues: [], errors: [], refreshedAt: null }
  return c.json(body)
})

// Pull every active issue from every connected workspace, in parallel.
// One failing key doesn't sink the board; it's reported in `errors`.
appRoutes.post('/issues/refresh', requireAccess, async (c) => {
  const userId = c.get('user').id
  const rows = await sql<WorkspaceRow[]>`SELECT * FROM workspaces WHERE user_id = ${userId}`

  const results = await Promise.all(
    rows.map(async (w) => {
      try {
        return { w, list: await fetchActiveIssues(decrypt(w.api_key_encrypted)), error: null }
      } catch (e) {
        return { w, list: [], error: String((e as Error).message ?? e) }
      }
    }),
  )

  const issues: BoardIssue[] = []
  const errors: string[] = []
  for (const r of results) {
    if (r.error) errors.push(`${r.w.org_name}: ${r.error}`)
    for (const it of r.list) {
      issues.push({ ...it, workspaceId: r.w.org_id, workspaceName: r.w.org_name, workspaceLogoUrl: r.w.org_logo_url })
    }
  }

  // If every workspace failed, keep the previous cache rather than blanking it.
  const anySuccess = rows.length === 0 || results.some((r) => !r.error)
  if (!anySuccess) {
    const body: IssuesPayload = { issues: null, errors, refreshedAt: null }
    return c.json(body)
  }
  const now = new Date()
  await sql`
    INSERT INTO issue_cache (user_id, payload, refreshed_at)
    VALUES (${userId}, ${sql.json(issues as never)}, ${now})
    ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, refreshed_at = EXCLUDED.refreshed_at`
  const body: IssuesPayload = { issues, errors, refreshedAt: now.getTime() }
  return c.json(body)
})
