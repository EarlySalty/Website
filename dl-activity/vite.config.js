import { defineConfig } from 'vite'

export default defineConfig({
  base: '/aktivitaet/',
  server: { port: 5175, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
