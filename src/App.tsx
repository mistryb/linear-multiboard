import { useCallback, useEffect, useState } from 'react'
import type { Me, Workspace } from '../shared/types'
import { api, ApiError } from './api'
import { useAllIssues } from './hooks/useAllIssues'
import { IssueBoard } from './components/IssueBoard'
import { LoginScreen, VerifyScreen } from './components/LoginScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { Paywall } from './components/Paywall'

// Top-level router: magic-link landing page, sign-in, or the signed-in app.
export function Root() {
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = loading
  const [error, setError] = useState<string | null>(null)
  const verifyToken =
    window.location.pathname === '/app/auth/verify'
      ? new URLSearchParams(window.location.search).get('token')
      : null

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null)
      else setError(String((e as Error).message ?? e))
    }
  }, [])

  useEffect(() => {
    if (!verifyToken) void loadMe()
  }, [verifyToken, loadMe])

  if (verifyToken) {
    return <VerifyScreen token={verifyToken} onSignedIn={() => window.location.replace('/app')} />
  }
  if (error) {
    return (
      <div className="app">
        <div className="center">
          <p className="form-error">{error}</p>
        </div>
      </div>
    )
  }
  if (me === undefined) return <Loading />
  if (me === null) return <LoginScreen />
  return <App me={me} onMeChanged={loadMe} />
}

function Loading() {
  return (
    <div className="app">
      <div className="center">
        <div className="spinner" />
      </div>
    </div>
  )
}

// Tab sentinels: the combined board and the settings page (others are org ids).
const ALL_TAB = 'all'
const SETTINGS_TAB = 'settings'

function App({ me, onMeChanged }: { me: Me; onMeChanged: () => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadWorkspaces = useCallback(async () => {
    try {
      setWorkspaces(await api.workspaces())
      setLoadError(null)
    } catch (e) {
      setLoadError(String((e as Error).message ?? e))
      setWorkspaces((w) => w ?? [])
    }
  }, [])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  // Returning from Stripe Checkout: the webhook may land a moment after the
  // redirect, so re-read the account once more shortly after.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('billing')) return
    window.history.replaceState(null, '', '/app')
    const t = setTimeout(onMeChanged, 2500)
    return () => clearTimeout(t)
  }, [onMeChanged])

  // If the selected workspace tab vanished (e.g. disconnected), fall back to All.
  useEffect(() => {
    if (
      workspaces &&
      activeTab !== ALL_TAB &&
      activeTab !== SETTINGS_TAB &&
      !workspaces.some((w) => w.organization.id === activeTab)
    ) {
      setActiveTab(ALL_TAB)
    }
  }, [workspaces, activeTab])

  // Only fetch issues for accounts that can see the board.
  const boardWorkspaces = me.billing.hasAccess ? workspaces : null
  const { issues, loading, errors, lastRefreshed, refresh } = useAllIssues(boardWorkspaces ?? NO_WORKSPACES)

  if (workspaces === null) return <Loading />

  async function signOut() {
    await api.logout().catch(() => {})
    window.location.replace('/app')
  }

  const active = workspaces.find((w) => w.organization.id === activeTab) ?? null
  const boardIssues = activeTab === ALL_TAB ? issues : issues.filter((i) => i.workspaceId === activeTab)
  const boardErrors =
    activeTab === ALL_TAB || !active ? errors : errors.filter((e) => e.startsWith(`${active.organization.name}:`))
  // No workspaces yet → settings doubles as onboarding.
  const showSettings = activeTab === SETTINGS_TAB || workspaces.length === 0

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          <span className="brand-badge" />
          MultiBoard
        </span>

        <div className="ws-tabs">
          {workspaces.length > 0 && (
            <button
              className={`ws-tab ${activeTab === ALL_TAB ? 'active' : ''}`}
              onClick={() => setActiveTab(ALL_TAB)}
              title="All active issues across every workspace"
            >
              <span className="ws-logo" />
              All Issues
            </button>
          )}
          {workspaces.map((w) => (
            <button
              key={w.organization.id}
              className={`ws-tab ${w.organization.id === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(w.organization.id)}
              title="Click to view"
            >
              {w.organization.logoUrl ? (
                <img className="ws-logo" src={w.organization.logoUrl} alt="" />
              ) : (
                <span className="ws-logo" />
              )}
              {w.organization.name}
            </button>
          ))}
        </div>

        <button
          className={`btn btn-ghost ${showSettings ? 'active' : ''}`}
          onClick={() => setActiveTab(SETTINGS_TAB)}
        >
          Settings
        </button>
        <button className="btn btn-ghost" onClick={signOut} title={`Signed in as ${me.email}`}>
          Sign out
        </button>
      </div>

      <TrialBanner me={me} onUpgrade={() => setActiveTab(SETTINGS_TAB)} />

      {loadError && (
        <div className="error-banner">
          <span>{loadError}</span>
        </div>
      )}

      {showSettings ? (
        <SettingsScreen me={me} workspaces={workspaces} onChanged={loadWorkspaces} />
      ) : !me.billing.hasAccess ? (
        <Paywall plans={me.billing.plans} />
      ) : activeTab === ALL_TAB ? (
        <IssueBoard
          title="All workspaces · active issues"
          issues={boardIssues}
          loading={loading}
          errors={boardErrors}
          lastRefreshed={lastRefreshed}
          onRefresh={refresh}
          showWorkspace
        />
      ) : active ? (
        <IssueBoard
          title={active.organization.name}
          issues={boardIssues}
          loading={loading}
          errors={boardErrors}
          lastRefreshed={lastRefreshed}
          onRefresh={refresh}
          showWorkspace={false}
        />
      ) : null}
    </div>
  )
}

const NO_WORKSPACES: Workspace[] = []

function TrialBanner({ me, onUpgrade }: { me: Me; onUpgrade: () => void }) {
  const { enabled, status, trialEndsAt, hasAccess } = me.billing
  if (!enabled || !hasAccess || status === 'active' || status === 'trialing' || !trialEndsAt) return null
  const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000)
  return (
    <div className="info-banner">
      <span>
        {status === 'past_due'
          ? 'Your last payment failed — update your card to keep access.'
          : `Free trial: ${days} day${days === 1 ? '' : 's'} left.`}
      </span>
      <button className="btn" onClick={onUpgrade}>
        {status === 'past_due' ? 'Update billing' : 'Subscribe'}
      </button>
    </div>
  )
}
