import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Where the on-disk issue cache lives. Resolved relative to this config file so
// it's stable regardless of the cwd the dev server is launched from.
const CACHE_FILE = fileURLToPath(new URL('./data/issues.json', import.meta.url))

// A dev-only endpoint that lets the browser persist the loaded issues to
// data/issues.json (GET to read, POST to write). This keeps the app otherwise
// "backend-less" — the middleware only exists while `vite` (dev) is running.
function issuesCachePlugin(): Plugin {
  return {
    name: 'issues-cache',
    configureServer(server) {
      server.middlewares.use('/api/issues-cache', async (req, res) => {
        if (req.method === 'GET') {
          try {
            const data = await readFile(CACHE_FILE, 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch {
            res.statusCode = 204 // no cache yet
            res.end()
          }
          return
        }

        if (req.method === 'POST') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const body = Buffer.concat(chunks).toString('utf8')
            JSON.parse(body) // validate before writing
            await mkdir(dirname(CACHE_FILE), { recursive: true })
            await writeFile(CACHE_FILE, body, 'utf8')
            res.statusCode = 200
            res.end('ok')
          } catch {
            res.statusCode = 400
            res.end('invalid cache payload')
          }
          return
        }

        res.statusCode = 405
        res.end()
      })
    },
  }
}

// Linear's GraphQL API doesn't send permissive CORS headers for arbitrary
// browser origins, so during local dev we proxy /graphql through the Vite dev
// server. This keeps the app fully "serverless" (there is no backend of our
// own) while sidestepping CORS. See README for details.
export default defineConfig({
  plugins: [react(), issuesCachePlugin()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'https://api.linear.app',
        changeOrigin: true,
      },
    },
  },
})
