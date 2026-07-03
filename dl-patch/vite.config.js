import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  base: '/patch/',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../dl-landing/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8772',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
