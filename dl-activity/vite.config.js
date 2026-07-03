import { defineConfig } from 'vite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const brandDir = resolve(here, '../dl-brand')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
}

function serveBrandAssets() {
  return {
    name: 'serve-dl-brand-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let pathname
        try {
          pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
        } catch {
          next()
          return
        }

        if (pathname !== '/brand' && !pathname.startsWith('/brand/')) {
          next()
          return
        }

        const relativePath = pathname.slice('/brand'.length) || '/'
        const filePath = resolve(brandDir, `.${relativePath}`)
        if (filePath !== brandDir && !filePath.startsWith(`${brandDir}${sep}`)) {
          next()
          return
        }

        if (!existsSync(filePath)) {
          next()
          return
        }

        const stats = statSync(filePath)
        if (!stats.isFile()) {
          next()
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-store')
        createReadStream(filePath).on('error', next).pipe(res)
      })
    },
  }
}

export default defineConfig({
  base: '/aktivitaet/',
  plugins: [serveBrandAssets()],
  server: { port: 5175, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
