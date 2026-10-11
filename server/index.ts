import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { readFile } from 'node:fs/promises'
import { authRoutes, pruneAuthTables } from './auth'
import { billingRoutes } from './billing'
import { appRoutes } from './boards'
import { migrate, sql } from './db'
import { env } from './env'

const app = new Hono()

app.use('*', secureHeaders())
// Cookie-authenticated mutations must come from our own origin. The Stripe
// webhook is server-to-server (signature-verified), so it's exempt.
app.use('/api/*', async (c, next) =>
  c.req.path === '/api/billing/webhook' ? next() : csrf({ origin: env.appUrl })(c, next),
)

app.get('/healthz', async (c) => {
  await sql`SELECT 1`
  return c.text('ok')
})

app.route('/api/auth', authRoutes)
app.route('/api/billing', billingRoutes)
app.route('/api', appRoutes)

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  return c.json({ error: 'Something went wrong.' }, 500)
})

// In production the server also serves the built UI (dist/): the marketing
// page at / and the app (a single-page app) under /app. In dev, Vite serves
// both and proxies /api here.
const STATIC_ROOT = process.env.STATIC_ROOT ?? './dist'

// The marketing page sells the hosted service, so instances without billing
// (self-hosted) skip it and go straight to the app.
app.get('/', async (c, next) => (env.stripe ? next() : c.redirect('/app')))
app.use('/*', serveStatic({ root: STATIC_ROOT }))
app.get('*', async (c) => {
  const path = c.req.path
  if (path.startsWith('/api/')) return c.json({ error: 'Not found.' }, 404)
  if (path !== '/app' && !path.startsWith('/app/')) return c.redirect('/')
  try {
    return c.html(await readFile(`${STATIC_ROOT}/app/index.html`, 'utf8'))
  } catch {
    return c.text('UI not built — run `npm run build`, or use `npm run dev` for development.', 404)
  }
})

await migrate()
await pruneAuthTables()
setInterval(() => void pruneAuthTables().catch(console.error), 6 * 60 * 60 * 1000).unref()

serve({ fetch: app.fetch, port: env.port }, ({ port }) => {
  console.log(`[server] listening on :${port} (APP_URL=${env.appUrl}, billing ${env.stripe ? 'on' : 'off'})`)
})
