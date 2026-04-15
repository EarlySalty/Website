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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
