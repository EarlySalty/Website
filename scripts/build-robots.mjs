#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { disallowRules } from './crawler-policy.mjs'

const target = process.argv[2] ?? fileURLToPath(new URL('../dl-landing/public/robots.txt', import.meta.url))
writeFileSync(target, `# Öffentliche Inhalte dürfen von allen Such- und Trainingscrawlern gelesen werden.
# Rechtstexte, persönliche Seiten und geschützte Bereiche bleiben ausgeschlossen.
User-agent: *
Allow: /
${disallowRules.map((path) => `Disallow: ${path}`).join('\n')}

Sitemap: https://deutsche-deadlock-community.de/sitemap.xml
`, 'utf8')
