import { useState, type FormEvent } from 'react'
import type { Me, Plan, PlanInterval, Workspace } from '../../shared/types'
import { api } from '../api'

// Connect/disconnect Linear workspaces, and manage the subscription.
// Doubles as onboarding when no workspace is connected yet.
export function SettingsScreen({
  me,
  workspaces,
  onChanged,
}: {
  me: Me
  workspaces: Workspace[]
  onChanged: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.addWorkspace(apiKey, label)
      setApiKey('')
      setLabel('')
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(w: Workspace) {
    if (!confirm(`Disconnect ${w.organization.name}? Its API key will be deleted.`)) return
    try {
      await api.removeWorkspace(w.id)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="settings">
      <section className="settings-section">
        <h2>Linear workspaces</h2>
        <p className="muted">
          Linear API keys are scoped to a single workspace, so connect one personal API key per
          workspace. Create one in each workspace at{' '}
          <a className="link" href="https://linear.app/settings/account/security" target="_blank" rel="noreferrer">
            Settings → Security &amp; access → Personal API keys
          </a>
          . Keys are encrypted at rest and only used to read issues.
        </p>

        {workspaces.length > 0 && (
          <ul className="ws-list">
            {workspaces.map((w) => (
              <li key={w.id}>
                {w.organization.logoUrl ? (
                  <img className="ws-logo" src={w.organization.logoUrl} alt="" />
                ) : (
                  <span className="ws-logo" />
                )}
                <span>{w.organization.name}</span>
                <span className="faint">
                  {w.label ? `${w.label} · ` : ''}key …{w.keyHint}
                </span>
                <span className="spacer" />
                <button className="btn btn-ghost" onClick={() => remove(w)}>
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="form form-row" onSubmit={add}>
          <input
            className="input"
            type="password"
            required
            autoComplete="off"
            placeholder="lin_api_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            className="input input-narrow"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Connecting…' : 'Connect workspace'}
          </button>
        </form>
        {error && <p className="form-error">{error}</p>}
      </section>

      {me.billing.enabled && (
        <section className="settings-section">
          <h2>Subscription</h2>
          <BillingSummary me={me} />
        </section>
      )}

      <section className="settings-section">
        <h2>Account</h2>
        <p className="muted">Signed in as {me.email}</p>
      </section>
    </div>
  )
}

function BillingSummary({ me }: { me: Me }) {
  const { status, trialEndsAt, hasAccess } = me.billing
  const subscribed = status && status !== 'canceled' && status !== 'incomplete_expired'
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const inTrial = !!trialEnd && trialEnd.getTime() > Date.now()

  return (
    <>
      <p className="muted">
        {subscribed
          ? `Status: ${status}.`
          : inTrial
            ? `Free trial — ends ${trialEnd!.toLocaleDateString()}.`
            : hasAccess
              ? 'Active.'
              : 'Your trial has ended.'}
      </p>
      {subscribed ? <PortalButton /> : <PlanButtons plans={me.billing.plans} />}
    </>
  )
}

function formatPrice({ amount, currency, interval }: Plan): string {
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)
  return `${money} / ${interval}`
}

// One Subscribe button per plan; the annual one shows its saving over monthly.
export function PlanButtons({ plans }: { plans: Plan[] }) {
  const [busy, setBusy] = useState<PlanInterval | null>(null)
  const [error, setError] = useState<string | null>(null)
  const monthly = plans.find((p) => p.interval === 'month')

  async function go(interval: PlanInterval) {
    setBusy(interval)
    setError(null)
    try {
      window.location.href = (await api.checkout(interval)).url
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  return (
    <>
      <div className="plan-buttons">
        {plans.map((plan) => {
          const saving =
            plan.interval === 'year' && monthly
              ? Math.round((1 - plan.amount / (monthly.amount * 12)) * 100)
              : 0
          return (
            <button
              key={plan.interval}
              className={`btn ${plan.interval === 'month' ? 'btn-primary' : ''}`}
              onClick={() => go(plan.interval)}
              disabled={busy !== null}
            >
              {busy === plan.interval ? 'Redirecting…' : `Subscribe · ${formatPrice(plan)}`}
              {saving > 0 && busy !== plan.interval && <span className="save-pill">Save {saving}%</span>}
            </button>
          )
        })}
      </div>
      {error && <p className="form-error">{error}</p>}
    </>
  )
}

function PortalButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      window.location.href = (await api.portal()).url
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={go} disabled={busy}>
        {busy ? 'Redirecting…' : 'Manage billing'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  )
}
