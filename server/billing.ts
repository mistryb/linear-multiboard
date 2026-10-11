import { Hono, type MiddlewareHandler } from 'hono'
import Stripe from 'stripe'
import type { Billing, Plan, PlanInterval } from '../shared/types'
import { requireUser, type AuthEnv, type UserRow } from './auth'
import { sql } from './db'
import { env } from './env'

// Stripe subscriptions for the hosted service. When STRIPE_* env vars aren't
// set (self-hosted), billing is off and every account has full access.

const stripe = env.stripe ? new Stripe(env.stripe.secretKey) : null

// past_due keeps access while Stripe retries the card; anything else locks the board.
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

// Plan prices are read from Stripe (so they're never duplicated in config) and
// cached for the life of the process — restart after changing a price.
let plansCache: Promise<Plan[]> | null = null

function plans(): Promise<Plan[]> {
  if (!stripe) return Promise.resolve([])
  plansCache ??= Promise.all(
    (Object.entries(env.stripe!.prices) as [PlanInterval, string | undefined][])
      .filter((e): e is [PlanInterval, string] => !!e[1])
      .map(async ([interval, id]) => {
        const price = await stripe!.prices.retrieve(id)
        return { interval, amount: price.unit_amount ?? 0, currency: price.currency }
      }),
  ).catch((e) => {
    plansCache = null // retry on the next request
    throw e
  })
  return plansCache
}

export async function billingFor(user: UserRow): Promise<Billing> {
  if (!env.stripe) {
    return { enabled: false, hasAccess: true, status: null, trialEndsAt: null, plans: [] }
  }
  const inTrial = !!user.trial_ends_at && user.trial_ends_at.getTime() > Date.now()
  const subscribed = !!user.subscription_status && ACTIVE_STATUSES.has(user.subscription_status)
  return {
    enabled: true,
    hasAccess: inTrial || subscribed,
    status: user.subscription_status,
    trialEndsAt: user.trial_ends_at?.toISOString() ?? null,
    plans: await plans(),
  }
}

/** Blocks the board (402) for accounts whose trial ended without a subscription. */
export const requireAccess: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (!(await billingFor(c.get('user'))).hasAccess) {
    return c.json({ error: 'Your trial has ended. Subscribe to keep using MultiBoard.' }, 402)
  }
  await next()
}

async function customerFor(user: UserRow): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id
  const customer = await stripe!.customers.create({ email: user.email, metadata: { userId: user.id } })
  await sql`UPDATE users SET stripe_customer_id = ${customer.id} WHERE id = ${user.id}`
  return customer.id
}

export const billingRoutes = new Hono<AuthEnv>()

billingRoutes.use('*', async (c, next) => {
  if (!stripe) return c.json({ error: 'Billing is not enabled on this instance.' }, 404)
  await next()
})

billingRoutes.post('/checkout', requireUser, async (c) => {
  const body = await c.req.json<{ interval?: unknown }>().catch(() => ({}) as { interval?: unknown })
  const price = body.interval === 'year' ? env.stripe!.prices.year : env.stripe!.prices.month
  if (!price) return c.json({ error: 'That plan isn’t available.' }, 400)
  const session = await stripe!.checkout.sessions.create({
    mode: 'subscription',
    customer: await customerFor(c.get('user')),
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/app?billing=success`,
    cancel_url: `${env.appUrl}/app?billing=cancelled`,
  })
  return c.json({ url: session.url })
})

billingRoutes.post('/portal', requireUser, async (c) => {
  const session = await stripe!.billingPortal.sessions.create({
    customer: await customerFor(c.get('user')),
    return_url: `${env.appUrl}/app`,
  })
  return c.json({ url: session.url })
})

// Stripe → us. Keeps users.subscription_status in sync with the customer's subscription.
billingRoutes.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Missing signature.' }, 400)

  let event: Stripe.Event
  try {
    event = await stripe!.webhooks.constructEventAsync(
      await c.req.text(),
      signature,
      env.stripe!.webhookSecret,
    )
  } catch {
    return c.json({ error: 'Invalid signature.' }, 400)
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      await sql`UPDATE users SET subscription_status = ${sub.status} WHERE stripe_customer_id = ${customerId}`
      break
    }
  }
  return c.json({ received: true })
})
