import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        home: 'index.html',
        community: 'community/index.html',
        features: 'features/index.html',
        coaching: 'coaching/index.html',
        streamer: 'streamer/index.html',
        guides: 'guides/index.html',
        join: 'beitreten/index.html',
      },
    },
  },
})
