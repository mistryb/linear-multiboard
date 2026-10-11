import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Two pages: the marketing site at / (index.html) and the app, a single-page
// app, at /app (app/index.html). In dev, Vite serves both and proxies /api to
// the Node server (`npm run dev:server`). In production the Node server serves
// the built dist/ itself, so there's a single origin and no proxy.

// Dev only: send client-side app routes like /app/auth/verify to the app's HTML.
function appRoutesFallback(): Plugin {
  return {
    name: 'app-routes-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if ((path === '/app' || path.startsWith('/app/')) && !path.includes('.')) {
          req.url = '/app/index.html' + (req.url!.includes('?') ? req.url!.slice(req.url!.indexOf('?')) : '')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), appRoutesFallback()],
  build: {
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT ?? 3000}`,
      },
    },
  },
})
