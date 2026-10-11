import { useEffect, useState } from 'react'
import type { BoardIssue, Workspace } from '../../shared/types'
import { api } from '../api'

export interface AllIssues {
  issues: BoardIssue[]
  loading: boolean
  errors: string[]
  lastRefreshed: number | null
  refresh: () => void
}

/**
 * Loads every active issue across all workspaces ONCE and holds it. Both the
 * combined board and the per-workspace boards are pure client-side filters over
 * this single dataset — switching tabs never hits the API. Cache-first on the
 * initial load (the server keeps the last board), then refreshes from Linear.
 */
export function useAllIssues(workspaces: Workspace[]): AllIssues {
  const [issues, setIssues] = useState<BoardIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (workspaces.length === 0) {
      setIssues([])
      setErrors([])
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setErrors([])
    ;(async () => {
      try {
        // On first load (not manual refresh), paint the last-saved issues instantly
        // while the live fetch runs.
        if (reloadKey === 0) {
          const cached = await api.cachedIssues()
          if (alive && cached.issues && cached.issues.length > 0) {
            setIssues(cached.issues)
            setLastRefreshed(cached.refreshedAt)
          }
        }

        const fresh = await api.refreshIssues()
        if (!alive) return
        setErrors(fresh.errors)
        // issues is null when every workspace failed — keep what's on screen.
        if (fresh.issues) {
          setIssues(fresh.issues)
          setLastRefreshed(fresh.refreshedAt)
        }
      } catch (e) {
        if (alive) setErrors([String((e as Error).message ?? e)])
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [workspaces, reloadKey])

  return {
    issues,
    loading,
    errors,
    lastRefreshed,
    refresh: () => setReloadKey((k) => k + 1),
  }
}
