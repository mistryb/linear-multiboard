import type { Plan } from '../../shared/types'
import { PlanButtons } from './SettingsScreen'

// Shown in place of the board when billing is on and the trial has lapsed.
export function Paywall({ plans }: { plans: Plan[] }) {
  return (
    <div className="center">
      <div className="card-panel">
        <div className="brand-badge" style={{ margin: '0 auto 16px', width: 40, height: 40 }} />
        <h1>Your free trial has ended</h1>
        <p>Subscribe to keep seeing all your Linear workspaces on one board. Your connected workspaces are saved.</p>
        <PlanButtons plans={plans} />
      </div>
    </div>
  )
}
