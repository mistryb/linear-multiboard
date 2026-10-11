import { useState, type FormEvent } from 'react'
import { api } from '../api'

// Passwordless sign-in: enter an email, get a one-time link.
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.requestLink(email)
      setSentTo(email.trim())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="center">
        <div className="card-panel">
          <div className="brand-badge" style={{ margin: '0 auto 16px', width: 40, height: 40 }} />
          <h1>Linear MultiBoard</h1>
          {sentTo ? (
            <>
              <p>
                We sent a sign-in link to <strong>{sentTo}</strong>. It expires in 15 minutes.
              </p>
              <button className="btn btn-ghost" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
            </>
          ) : (
            <>
              <p>All your Linear workspaces on one board. Sign in with your email — no password needed.</p>
              <form className="form" onSubmit={submit}>
                <input
                  className="input"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </form>
              {error && <p className="form-error">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Landing page for the emailed link. Requires a click (rather than signing in
// on load) so link-scanning mail filters can't consume the one-time token.
export function VerifyScreen({ token, onSignedIn }: { token: string; onSignedIn: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.verify(token)
      window.history.replaceState(null, '', '/app')
      onSignedIn()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="center">
        <div className="card-panel">
          <div className="brand-badge" style={{ margin: '0 auto 16px', width: 40, height: 40 }} />
          <h1>Sign in to MultiBoard</h1>
          {error ? (
            <>
              <p className="form-error">{error}</p>
              <a className="btn" href="/app">
                Back to sign in
              </a>
            </>
          ) : (
            <button className="btn btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
