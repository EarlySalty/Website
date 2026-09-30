import { createServer, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'public-coaching-html',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, context) {
          const marker = '<div id="root"></div>'
          if (!html.includes(marker)) throw new Error('Public coaching HTML root marker missing')
          // Use Vite's TSX loader, not a second copy of the public content.
          // A build-only middleware server opens no listening port and is always closed.
          const server = context.server ?? await createServer({
            configFile: false,
            root: __dirname,
            plugins: [react()],
            appType: 'custom',
            optimizeDeps: { noDiscovery: true, include: [] },
            server: { middlewareMode: true, hmr: false, watch: null },
          })
          try {
            const { PublicCoachingPage } = await server.ssrLoadModule('/src/components/CoachingPublic.tsx')
            const { coachingStructuredData } = await server.ssrLoadModule('/src/seo.ts')
            // Static, first-party content only. Never read live profiles, auth or session data.
            const content = renderToStaticMarkup(createElement(PublicCoachingPage))
            const json = JSON.stringify(coachingStructuredData).replace(/</g, '\\u003c')
            return html.replace(marker, '<div id="root">' + content + '</div>')
              .replace('</head>', '<script id="coaching-structured-data" type="application/ld+json">' + json + '</script></head>')
          } finally {
            if (!context.server) await server.close()
          }
        },
      },
    },
  ],
  base: '/coaching/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/coaching/api': {
        target: 'http://localhost:8772',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/coaching\/api/, '/api'),
      },
    },
  },
})
