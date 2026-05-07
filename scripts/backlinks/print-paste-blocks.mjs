#!/usr/bin/env node
/**
 * Generiert Manual-Paste-Blöcke für Owned-Properties, deren API-Wege
 * Token-Setup oder UI-Scoping erfordern, das wir hier nicht durchziehen:
 *
 *   - Discord-Server-Description (Settings → Server-Profil)
 *   - Twitch-Channel-About-Section (Creator-Dashboard → Channel)
 *   - Steam-Community-Group-Summary (Group-Edit-Page)
 *
 * Output ist plain text — copy-paste ins jeweilige Settings-Panel.
 *
 * Usage:
 *   node scripts/backlinks/print-paste-blocks.mjs            # alle Blöcke
 *   node scripts/backlinks/print-paste-blocks.mjs discord    # nur einer
 *   node scripts/backlinks/print-paste-blocks.mjs twitch
 *   node scripts/backlinks/print-paste-blocks.mjs steam
 */

const SITE = 'https://deutsche-deadlock-community.de'
const DISCORD = 'https://discord.gg/PhkP3WgY7w'

const which = process.argv[2] || 'all'

const sep = (label) => `
============================================================
${label}
============================================================
`

const blocks = {
  discord: () => `${sep('1) DISCORD-SERVER-DESCRIPTION')}
Wo: Server-Settings → Server-Profil → Server-Description (Discoverable Server)
Limit: 300 Zeichen.

────────────────────────────────────────────────────────────
Aktive deutsche Deadlock-Community: kostenloses Coaching, Voice-Lanes für jeden Rank, Patchnotes auf Deutsch und ein Streamer-Netzwerk. Mehr Infos und alle Tools: ${SITE.replace(/^https?:\/\//, '')}
────────────────────────────────────────────────────────────`,

  twitch: () => `${sep('2) TWITCH-CHANNEL-"ABOUT"-SECTION')}
Wo: Creator Dashboard → Settings → Channel → Edit Panels (oder About-Field).
Markdown wird unterstützt. Eingabe als neues Panel oder im About-Text.

Panel-Title:  Deutsche Deadlock Community
Panel-Body (Markdown):
────────────────────────────────────────────────────────────
🎮 **Deadlock zocken auf Deutsch** — komm in die Community.

- 💬 Discord: ${DISCORD}
- 🌐 Website: ${SITE}/
- 📖 Anfänger-Guide: ${SITE}/guides/anfaenger/
- 🦸 Helden-Übersicht: ${SITE}/helden/

Kostenlos, keine Ads, freundlich.
────────────────────────────────────────────────────────────`,

  steam: () => `${sep('3) STEAM-COMMUNITY-GROUP-SUMMARY')}
Wo: Steam-Group-Page → "Edit Group" → Summary.
BBCode wird unterstützt.

────────────────────────────────────────────────────────────
[h1]Deutsche Deadlock Community[/h1]

[b]Die aktivste deutschsprachige Community rund um Deadlock von Valve.[/b]

[list]
[*] [url=${DISCORD}]Discord beitreten[/url]
[*] [url=${SITE}/]Website[/url]
[*] [url=${SITE}/guides/anfaenger/]Anfänger-Guide auf Deutsch[/url]
[*] [url=${SITE}/helden/]Alle 38 Helden im Überblick[/url]
[/list]

Kostenloses Coaching, Voice-Lanes für jeden Rank, Patchnotes auf Deutsch.
────────────────────────────────────────────────────────────`,
}

if (which === 'all') {
  console.log(blocks.discord())
  console.log(blocks.twitch())
  console.log(blocks.steam())
} else if (blocks[which]) {
  console.log(blocks[which]())
} else {
  console.error(`Unknown block: ${which}. Verfügbar: discord, twitch, steam, all`)
  process.exit(1)
}
