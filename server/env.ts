// All runtime configuration comes from environment variables (see .env.example).
// Required values are checked once at startup so a misconfigured deploy fails fast.

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name} (see .env.example).`)
  return value
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

function encryptionKey(): Buffer {
  const raw = required('ENCRYPTION_KEY')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes, as 64 hex chars or base64 (try `openssl rand -hex 32`).')
  }
  return key
}

const appUrl = (optional('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '')

const stripeSecretKey = optional('STRIPE_SECRET_KEY')
const stripeWebhookSecret = optional('STRIPE_WEBHOOK_SECRET')
const stripePriceMonthly = optional('STRIPE_PRICE_MONTHLY')
const stripePriceAnnual = optional('STRIPE_PRICE_ANNUAL')

export const env = {
  port: Number(optional('PORT') ?? 3000),
  appUrl,
  secureCookies: appUrl.startsWith('https://'),
  databaseUrl: required('DATABASE_URL'),
  encryptionKey: encryptionKey(),

  // Magic-link email. Without SMTP_URL, sign-in links are printed to the server
  // log instead — fine for local dev and single-user self-hosting.
  smtpUrl: optional('SMTP_URL'),
  mailFrom: optional('MAIL_FROM') ?? 'Linear MultiBoard <no-reply@localhost>',

  // Optional sign-up allowlist: comma-separated emails and/or @domains. Empty = anyone.
  allowedEmails: (optional('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Billing is on when the secret key, webhook secret and monthly price are set
  // (the annual price is optional). Self-hosters leave them blank and every
  // account gets full access.
  stripe:
    stripeSecretKey && stripeWebhookSecret && stripePriceMonthly
      ? {
          secretKey: stripeSecretKey,
          webhookSecret: stripeWebhookSecret,
          prices: { month: stripePriceMonthly, year: stripePriceAnnual },
        }
      : null,
  trialDays: Number(optional('TRIAL_DAYS') ?? 14),
}
