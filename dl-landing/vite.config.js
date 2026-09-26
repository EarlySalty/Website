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
        survey: 'survey/index.html',
        coaching: 'coaching/index.html',
        streamer: 'streamer/index.html',
        helden: 'helden/index.html',
        guideAnfaenger: 'guides/anfaenger/index.html',
        beitreten: 'beitreten/index.html',
        transparenz: 'transparenz/index.html',
        wohin: 'wohin/index.html',
        blog: 'blog/index.html',
        blogTwitchSzene2026: 'blog/twitch-szene-2026/index.html',
        blogDiscordZukunft: 'blog/discord-zukunft/index.html',
        blogSpamBots2026: 'blog/spam-bots-2026/index.html',
        blogDeadlockStimmung2026: 'blog/deadlock-stimmung-2026/index.html',
        blogDeadlockSpiritSlop2026: 'blog/deadlock-spirit-slop-2026/index.html',
        blogDeadlockObjectives2026: 'blog/deadlock-objectives-2026/index.html',
        blogDeadlockGuardianImpact2026: 'blog/deadlock-guardian-impact-2026/index.html',
      },
    },
  },
})
