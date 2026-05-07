#!/usr/bin/env node
/**
 * Patcht README.md in den eigenen Bot-Repos mit einem standardisierten
 * Footer-Block, der auf deutsche-deadlock-community.de verlinkt.
 *
 * Idempotent durch HTML-Marker — wiederholtes Ausführen überschreibt nur
 * den Block zwischen den Markern, alles drumherum bleibt unangetastet.
 *
 * Usage:
 *   node scripts/backlinks/update-github-readmes.mjs              # dry-run, zeigt nur was passieren würde
 *   node scripts/backlinks/update-github-readmes.mjs --apply      # File-Änderung, kein Commit
 *   node scripts/backlinks/update-github-readmes.mjs --apply --commit  # Änderung + Commit + Push
 *
 * Sicherheit:
 * - Lehnt ab wenn das Repo "schmutzig" ist (uncommitted changes außer README.md), außer mit --dirty-ok
 * - Pusht nur, wenn der Commit erfolgreich war
 * - README muss existieren — fehlt sie, wird das Repo geskippt mit Warnung
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Konfiguration ───────────────────────────────────────────────────────
const DOCS_ROOT = resolve(process.env.HOME || '~', 'Documents')

const REPOS = [
  { dir: 'Deadlock-Bots',           name: 'Deadlock-Bots',           role: 'Master-Bot der Deutschen Deadlock Community' },
  { dir: 'Deadlock--Patchnotes-Bot', name: 'Patchnotes-Bot',          role: 'übersetzt Deadlock-Patchnotes auf Deutsch' },
  { dir: 'Deadlock-Steam-Bot',      name: 'Steam-Bot',               role: 'verwaltet Steam-Verifikation und Rank-Sync' },
  { dir: 'Deadlock-Twitch-Bot',     name: 'Twitch-Bot',              role: 'postet Live-Streamer der Community' },
  { dir: 'Deadlock-Turniere',       name: 'Turniere-Plattform',      role: 'organisiert Community-Turniere' },
]

const MARKER_START = '<!-- DDC-LINK-START -->'
const MARKER_END = '<!-- DDC-LINK-END -->'
const SITE_URL = 'https://deutsche-deadlock-community.de'
const DISCORD_INVITE = 'https://discord.gg/PhkP3WgY7w'

const COMMIT_MESSAGE = 'docs: link to deutsche-deadlock-community.de'

// ── CLI-Args ────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const doCommit = args.has('--commit')
const dirtyOk = args.has('--dirty-ok')

// ── Helpers ─────────────────────────────────────────────────────────────
function blockFor(repo) {
  return `${MARKER_START}

## Deutsche Deadlock Community

Dieser Bot ist Teil der **[Deutschen Deadlock Community](${SITE_URL}/)** — ${repo.role}.

- 🌐 Website: [${SITE_URL.replace(/^https?:\/\//, '')}](${SITE_URL}/)
- 💬 Discord: [${DISCORD_INVITE.replace(/^https?:\/\//, '')}](${DISCORD_INVITE})
- 🎮 [Helden-Übersicht auf Deutsch](${SITE_URL}/helden/) · [Anfänger-Guide](${SITE_URL}/guides/anfaenger/)

${MARKER_END}`
}

function patchReadme(content, block) {
  const startIdx = content.indexOf(MARKER_START)
  const endIdx = content.indexOf(MARKER_END)
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing block (inclusive of markers)
    const before = content.slice(0, startIdx)
    const after = content.slice(endIdx + MARKER_END.length)
    return before.trimEnd() + '\n\n' + block + '\n' + after.replace(/^\s+/, '')
  }
  // Append at end
  const trimmed = content.trimEnd()
  return trimmed + '\n\n' + block + '\n'
}

function git(cwd, ...gitArgs) {
  return execFileSync('git', gitArgs, { cwd, encoding: 'utf8' }).trim()
}

function hasOtherChanges(cwd) {
  try {
    const out = git(cwd, 'status', '--porcelain')
    if (!out) return false
    // Filter: nur README.md geänderte Lines wären ok
    return out
      .split('\n')
      .map((line) => line.slice(3))
      .some((path) => path && path !== 'README.md')
  } catch {
    return true // sicherheitshalber als "dirty" werten wenn git status fehlschlägt
  }
}

// ── Haupt-Loop ──────────────────────────────────────────────────────────
console.log(`[backlinks] Mode: ${apply ? (doCommit ? 'apply + commit + push' : 'apply (no commit)') : 'dry-run'}`)
console.log('')

let touched = 0
let skipped = 0
let errors = 0

for (const repo of REPOS) {
  const repoPath = resolve(DOCS_ROOT, repo.dir)
  const readmePath = resolve(repoPath, 'README.md')

  if (!existsSync(repoPath)) {
    console.log(`⚠  ${repo.dir} — Repo-Pfad fehlt (${repoPath}), skip`)
    skipped += 1
    continue
  }
  if (!existsSync(readmePath)) {
    console.log(`⚠  ${repo.dir} — README.md fehlt, skip`)
    skipped += 1
    continue
  }

  const current = readFileSync(readmePath, 'utf8')
  const block = blockFor(repo)
  const next = patchReadme(current, block)

  if (current === next) {
    console.log(`✓  ${repo.dir} — README bereits aktuell`)
    skipped += 1
    continue
  }

  console.log(`✎  ${repo.dir} — Änderung würde geschrieben werden`)
  if (!apply) {
    console.log(`    (dry-run — nicht geschrieben)`)
    touched += 1
    continue
  }

  // Safety: dirty repo?
  if (doCommit && !dirtyOk && hasOtherChanges(repoPath)) {
    console.log(`✗  ${repo.dir} — Repo hat andere unstaged changes; überspringe Commit. Mit --dirty-ok erzwingen.`)
    skipped += 1
    continue
  }

  writeFileSync(readmePath, next, 'utf8')
  touched += 1

  if (!doCommit) {
    console.log(`    geschrieben (kein Commit angefordert)`)
    continue
  }

  try {
    git(repoPath, 'add', 'README.md')
    git(repoPath, 'commit', '-m', `${COMMIT_MESSAGE}\n\nCo-authored-by: Claude Code (Claude Opus) <claude-code@local>`)
    git(repoPath, 'push')
    console.log(`    committed + pushed`)
  } catch (err) {
    console.error(`    ✗ git-Fehler: ${err?.message || err}`)
    errors += 1
  }
}

console.log('')
console.log(`[backlinks] touched=${touched}  skipped=${skipped}  errors=${errors}`)
process.exit(errors > 0 ? 1 : 0)
