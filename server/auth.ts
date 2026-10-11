import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sql } from './db'
import { env } from './env'
import { hashToken, randomToken } from './crypto'
import { sendMagicLink } from './mail'

// Passwordless auth: email → one-time magic link → session cookie.

const SESSION_COOKIE = 'mb_session'
const SESSION_DAYS = 30
const LINK_MINUTES = 15
const MAX_LINKS_PER_WINDOW = 5 // per email, per LINK_MINUTES

export interface UserRow {
  id: string
  email: string
  trial_ends_at: Date | null
  stripe_customer_id: string | null
  subscription_status: string | null
}

export type AuthEnv = { Variables: { user: UserRow } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailAllowed(email: string): boolean {
  if (env.allowedEmails.length === 0) return true
  const domain = email.slice(email.lastIndexOf('@'))
  return env.allowedEmails.some((a) => a === email || a === domain)
}

/** Rejects unauthenticated requests; otherwise exposes the user as c.get('user'). */
export const requireUser: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return c.json({ error: 'Not signed in.' }, 401)
  const [user] = await sql<UserRow[]>`
    SELECT u.id, u.email, u.trial_ends_at, u.stripe_customer_id, u.subscription_status
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`
  if (!user) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ error: 'Session expired.' }, 401)
  }
  c.set('user', user)
  await next()
}

async function startSession(c: Context, userId: string) {
  const token = randomToken()
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export const authRoutes = new Hono()

// Request a magic link. Always answers the same way (unless rate-limited or
// disallowed) so the endpoint can't be used to probe which emails have accounts.
authRoutes.post('/request', async (c) => {
  const body = await c.req.json<{ email?: unknown }>().catch(() => ({}) as { email?: unknown })
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return c.json({ error: 'Enter a valid email address.' }, 400)
  }
  if (!emailAllowed(email)) {
    return c.json({ error: 'This email is not allowed to sign in to this instance.' }, 403)
  }

  const [{ count }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM login_tokens
    WHERE email = ${email} AND created_at > now() - make_interval(mins => ${LINK_MINUTES})`
  if (count >= MAX_LINKS_PER_WINDOW) {
    return c.json({ error: 'Too many sign-in links requested. Try again in a few minutes.' }, 429)
  }

  const token = randomToken()
  await sql`
    INSERT INTO login_tokens (token_hash, email, expires_at)
    VALUES (${hashToken(token)}, ${email}, now() + make_interval(mins => ${LINK_MINUTES}))`
  // The link opens a confirm page that POSTs the token, so email scanners that
  // prefetch links can't burn it.
  await sendMagicLink(email, `${env.appUrl}/app/auth/verify?token=${encodeURIComponent(token)}`)
  return c.json({ ok: true })
})

// Exchange a magic-link token for a session, creating the account on first sign-in.
authRoutes.post('/verify', async (c) => {
  const body = await c.req.json<{ token?: unknown }>().catch(() => ({}) as { token?: unknown })
  if (typeof body.token !== 'string' || !body.token) {
    return c.json({ error: 'Missing sign-in token.' }, 400)
  }

  const [row] = await sql<{ email: string }[]>`
    UPDATE login_tokens SET used_at = now()
    WHERE token_hash = ${hashToken(body.token)} AND used_at IS NULL AND expires_at > now()
    RETURNING email`
  if (!row) {
    return c.json({ error: 'This sign-in link is invalid or has expired. Request a new one.' }, 400)
  }

  const [user] = await sql<{ id: string }[]>`
    INSERT INTO users (email, trial_ends_at)
    VALUES (${row.email}, now() + make_interval(days => ${env.trialDays}))
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id`
  await startSession(c, user.id)
  return c.json({ ok: true })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

/** Housekeeping: drop expired sessions and used/expired login tokens. */
export async function pruneAuthTables() {
  await sql`DELETE FROM sessions WHERE expires_at < now()`
  await sql`DELETE FROM login_tokens WHERE expires_at < now() - interval '1 day'`
}
