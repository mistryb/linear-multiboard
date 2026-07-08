import { useEffect, useState } from 'react'
import type { BoardIssue, Workspace } from '../linear/types'
import { fetchActiveIssues, type ActiveIssue } from '../linear/api'
import { loadIssuesCache, saveIssuesCache } from '../linear/cache'

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
 * initial load, then refreshes from Linear and persists back to disk.
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
      // On first load (not manual refresh), paint the last-saved issues instantly
      // while the live fetch runs in the background.
      if (reloadKey === 0) {
        const cached = await loadIssuesCache<BoardIssue>()
        if (alive && cached && cached.issues.length > 0) {
          setIssues(cached.issues)
          setLastRefreshed(cached.savedAt)
        }
      }

      // Fetch all workspaces in parallel; one failing key shouldn't sink the board.
      const results = await Promise.all(
        workspaces.map(async (w) => {
          try {
            return { ws: w, list: await fetchActiveIssues(w.apiKey), error: null as string | null }
          } catch (e) {
            return { ws: w, list: [] as ActiveIssue[], error: String((e as Error).message ?? e) }
          }
        }),
      )
      if (!alive) return

      const all: BoardIssue[] = []
      const errs: string[] = []
      for (const r of results) {
        if (r.error) errs.push(`${r.ws.organization.name}: ${r.error}`)
        for (const it of r.list) {
          all.push({
            ...it,
            workspaceId: r.ws.organization.id,
            workspaceName: r.ws.organization.name,
            workspaceLogoUrl: r.ws.organization.logoUrl,
          })
        }
      }

      setErrors(errs)
      // If every workspace failed, keep whatever we're already showing (likely
      // the cache) rather than blanking the board. Otherwise adopt the fresh
      // data and persist it for next time.
      const anySuccess = results.some((r) => !r.error)
      if (anySuccess) {
        setIssues(all)
        setLastRefreshed(Date.now())
        void saveIssuesCache(all)
      }
      setLoading(false)
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
