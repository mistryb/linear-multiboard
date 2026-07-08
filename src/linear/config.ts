import type { WorkspaceConfig } from './types'

// The app is driven by a JSON file of per-workspace personal API keys, served
// as a static asset from /public. Edit public/linear.config.json and refresh —
// there's no OAuth, no backend, and keys never get bundled into the build.

const CONFIG_URL = '/linear.config.json'

const SETUP_HINT =
  'Copy public/linear.config.example.json to public/linear.config.json and add a Linear personal API key for each workspace.'

export class ConfigMissingError extends Error {}

/**
 * Load and validate the workspace list from /linear.config.json.
 * Throws ConfigMissingError if the file isn't there yet (so the UI can show
 * setup instructions), and a plain Error for malformed content.
 */
export async function loadConfig(): Promise<WorkspaceConfig[]> {
  let res: Response
  try {
    res = await fetch(CONFIG_URL, { cache: 'no-store' })
  } catch {
    throw new Error(`Could not fetch ${CONFIG_URL}. ${SETUP_HINT}`)
  }

  if (res.status === 404) {
    throw new ConfigMissingError(`No ${CONFIG_URL} found. ${SETUP_HINT}`)
  }
  if (!res.ok) {
    throw new Error(`Failed to load ${CONFIG_URL} (${res.status}).`)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    // Dev servers often fall back to index.html for missing files, which lands
    // here as an HTML-parse failure — treat it as "not configured yet".
    throw new ConfigMissingError(
      `${CONFIG_URL} is missing or not valid JSON. ${SETUP_HINT}`,
    )
  }

  const list = (json as { workspaces?: unknown }).workspaces
  if (!Array.isArray(list)) {
    throw new Error(`${CONFIG_URL} must contain a "workspaces" array. ${SETUP_HINT}`)
  }

  const entries: WorkspaceConfig[] = []
  for (const item of list) {
    const apiKey = (item as { apiKey?: unknown })?.apiKey
    if (typeof apiKey !== 'string' || !apiKey.trim()) continue
    // Skip the untouched placeholder so a fresh copy shows setup, not errors.
    if (apiKey.trim().startsWith('lin_api_REPLACE_ME')) continue
    const label = (item as { label?: unknown })?.label
    entries.push({
      apiKey: apiKey.trim(),
      label: typeof label === 'string' && label.trim() ? label.trim() : undefined,
    })
  }
  return entries
}
