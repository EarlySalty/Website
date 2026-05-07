import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        home: 'index.html',
        mitspieler: 'mitspieler/index.html',
        coaching: 'coaching/index.html',
        streamer: 'streamer/index.html',
        helden: 'helden/index.html',
        guideAnfaenger: 'guides/anfaenger/index.html',
      },
    },
  },
})
