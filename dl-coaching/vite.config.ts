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
            return html.replace(marker, '<div id="root">' + renderToStaticMarkup(createElement(PublicCoachingPage)) + '</div>')
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
