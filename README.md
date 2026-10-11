<p align="center">
  <img src="assets/banner.svg" alt="Linear MultiBoard — all your Linear workspaces on one screen" width="100%" />
</p>

<h1 align="center">Linear MultiBoard</h1>

<p align="center">
  View <strong>all of your Linear workspaces</strong> as Kanban boards on one screen.<br/>
  Read-only, open source, <strong>self-hostable</strong> with one <code>docker compose up</code>.
</p>

<p align="center">
  <a href="https://linearmultiboard.bhavikmistry.com"><strong>🌐 linearmultiboard.bhavikmistry.com</strong></a>
  &nbsp;·&nbsp;
  <a href="#self-hosting">Self-hosting</a>
  &nbsp;·&nbsp;
  <a href="#development">Development</a>
  &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-5e6ad2" />
  <img alt="Read-only" src="https://img.shields.io/badge/mode-read--only-3fb950" />
  <img alt="Docker" src="https://img.shields.io/badge/deploy-docker-2496ed" />
  <img alt="Built with Vite + React" src="https://img.shields.io/badge/vite%20%2B%20react-646cff" />
</p>

<p align="center">
  <img src="assets/board-preview.svg" alt="Linear MultiBoard showing several Linear workspaces as Kanban columns" width="100%" />
</p>

---

- One tab per Linear workspace across the top, plus an **All Issues** board that
  merges every workspace.
- Columns ordered Triage → Backlog → Todo → In Progress; cards show identifier,
  priority, labels, and assignee. Click a card to open it in Linear.
- Read-only: nothing is ever written back to Linear.
- Multi-user: each person signs in with a magic link and connects their own
  workspaces. API keys are encrypted at rest and never sent to the browser.
- Optional Stripe subscriptions (free trial → paid) for running it as a hosted
  service. Off by default, so self-hosted installs are fully unlocked.

## Self-hosting

You need Docker with Compose.

```bash
git clone https://github.com/mistryb/linear-multiboard.git
cd linear-multiboard
cp .env.example .env
```

Edit `.env`:

| Variable | |
| --- | --- |
| `APP_URL` | Public URL you'll serve it at, e.g. `https://board.example.com` (or `http://localhost:3000`). |
| `ENCRYPTION_KEY` | `openssl rand -hex 32`. Encrypts stored Linear keys. Back it up: if it's lost, workspaces must be re-added. |
| `SMTP_URL`, `MAIL_FROM` | For emailing sign-in links. Leave blank to print links to the server log (`docker compose logs app`). This is fine for a single user. |
| `ALLOWED_EMAILS` | Comma-separated emails / `@domains` allowed to sign in. **Set this** on an internet-facing instance, e.g. `@yourcompany.com`. |
| `POSTGRES_PASSWORD` | Optional; change from the default if the database port is reachable. |

Leave the `STRIPE_*` variables blank to turn billing off.

```bash
docker compose up -d
```

Open `APP_URL`, sign in with your email, and connect workspaces under
**Settings**. With billing off, `/` goes straight to the app at `/app`. The
marketing page is only shown on instances that sell subscriptions. Put it behind a TLS-terminating reverse proxy (Caddy, nginx,
Traefik, a cloud load balancer) for anything beyond localhost. Session cookies
are marked `Secure` automatically when `APP_URL` is `https://`.

**Without Docker:** use Node 20.6+ and Postgres 14+, set the same variables plus
`DATABASE_URL`, then `npm ci && npm run build && npm start`. Database migrations
run automatically on boot. `GET /healthz` is a health check.

## Running it as a paid service

Set the Stripe variables to turn billing on:

1. In Stripe, create a Product with a recurring monthly Price and, optionally, a
   discounted yearly Price. Copy their IDs to `STRIPE_PRICE_MONTHLY` and
   `STRIPE_PRICE_ANNUAL`. The app reads the amounts from Stripe, so prices are
   never duplicated in config. Restart the app after changing them.
2. Add a webhook endpoint at `https://<APP_URL>/api/billing/webhook` listening for
   `customer.subscription.created`, `customer.subscription.updated` and
   `customer.subscription.deleted`. Copy its signing secret to
   `STRIPE_WEBHOOK_SECRET`.
3. Set `STRIPE_SECRET_KEY`, and configure the Customer Portal (used for **Manage
   billing**) to allow cancelling, updating payment methods, and switching
   between the monthly and yearly prices.

The marketing page (`index.html`) lists prices as static text. Update it if you
change them in Stripe.

New accounts get a `TRIAL_DAYS` (default 14) free trial with no card. After it
ends, the board is replaced by a Subscribe screen until the account has an
`active`, `trialing` or `past_due` subscription. Connected workspaces are kept,
so subscribing restores the board immediately.

To test locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## How it works

```
browser ──(session cookie)──▶ Node server (Hono) ──(per-workspace API key)──▶ api.linear.app
                                    │
                                 Postgres: users, sessions, encrypted keys, last-fetched board
```

Linear personal API keys are scoped to a **single workspace**, so each user
creates one key per workspace (**Settings → Security & access → Personal API
keys** in Linear) and pastes it into MultiBoard's Settings. The server verifies
the key, stores it AES-256-GCM encrypted, and uses it server-side to fetch
active issues. Every query is scoped to the signed-in user, which is the tenant
boundary.

The last-fetched board is cached per user, so the page paints instantly and then
refreshes from Linear. Boards fetch up to 200 active (non-done, non-canceled)
issues per workspace, plus up to 10 labels per card. These page sizes are kept
modest to stay under Linear's GraphQL complexity limit.

## Development

```bash
cp .env.example .env              # then set ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up -d db           # Postgres on localhost:5432
npm install
npm run dev                       # API on :3000 + Vite UI on :5173 (proxies /api)
```

Open http://localhost:5173 for the marketing page, or http://localhost:5173/app
for the app. With `SMTP_URL` blank, the sign-in link is printed
in the `server` output. `npm run typecheck` checks the client and server;
`npm run build` produces `dist/` (UI) and `build/` (server).

## Project layout

```
server/
  index.ts       Hono app: security headers, CSRF, routes, serves dist/ in production
  env.ts         environment config (validated at boot)
  db.ts          Postgres client + migration runner (server/migrations/*.sql)
  auth.ts        magic-link sign-in, sessions
  boards.ts      workspaces CRUD + issue fetching (all scoped per user)
  billing.ts     Stripe checkout, portal, webhook, access gate
  linear.ts      Linear GraphQL client
  crypto.ts      API-key encryption, token hashing
shared/types.ts  types shared by server and UI
src/
  App.tsx        auth routing, workspace tabs, settings, paywall
  api.ts         browser → server client
  components/    IssueBoard, IssueCard, LoginScreen, SettingsScreen, Paywall
  hooks/         useAllIssues (cache-first, then refresh)
index.html       marketing page, served at / (plain HTML + inline CSS)
app/index.html   app entry, served at /app
public/          favicon + social image shared by both pages
Dockerfile, docker-compose.yml, .env.example
```

## License

Licensed under the [MIT License](LICENSE) — free to use, modify, and distribute,
including commercially. Just keep the copyright and license notice.

© 2026 Bhavik Mistry

Not affiliated with or endorsed by Linear. “Linear” is a trademark of Linear
Orbit, Inc.
