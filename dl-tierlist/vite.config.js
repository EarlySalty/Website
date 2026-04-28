import { defineConfig } from 'vite'

export default defineConfig({
  base: '/builds/',
  server: { port: 5174, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        home: 'index.html',
        history: 'history/index.html',
        admin: 'admin/index.html',
      },
    },
  },
})
