import postgres from 'postgres'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { env } from './env'

export const sql = postgres(env.databaseUrl, {
  // Managed Postgres (e.g. Laravel Cloud / Neon) requires TLS, but injected URLs
  // don't always say so. Unless the URL sets sslmode, try TLS and fall back to
  // plain for local Postgres.
  ssl: /[?&]sslmode=/.test(env.databaseUrl) ? undefined : 'prefer',
  // Keep Postgres NOTICEs (e.g. "relation already exists") out of the logs.
  onnotice: () => {},
})

/**
 * Apply any not-yet-run .sql files from server/migrations, in filename order,
 * each in its own transaction. Runs on every boot; already-applied files are
 * skipped. An advisory lock keeps concurrent replicas from racing.
 */
export async function migrate(dir: string = fileURLToPath(new URL('./migrations', import.meta.url))) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(724411)`
    const applied = new Set(
      (await tx<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
    )
    for (const file of files) {
      if (applied.has(file)) continue
      await tx.unsafe(await readFile(`${dir}/${file}`, 'utf8'))
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`
      console.log(`[db] applied migration ${file}`)
    }
  })
}
