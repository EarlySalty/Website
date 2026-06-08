import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
