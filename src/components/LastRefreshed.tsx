import { useEffect, useState } from 'react'

function format(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

// A self-ticking "Updated 12s ago" label. Re-renders every 15s so the relative
// time stays fresh; the full timestamp is on hover.
export function LastRefreshed({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  if (!at) return null
  return (
    <span className="faint" title={`Last refreshed ${new Date(at).toLocaleString()}`}>
      Updated {format(at, now)}
    </span>
  )
}
