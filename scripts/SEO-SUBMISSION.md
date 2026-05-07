# SEO-Submission Runbook

Operator-Anleitung für die einmalige Einrichtung von Google Search Console + Bing Webmaster Tools, plus den wiederkehrenden Submit-Flow.

## Einmal-Setup

### 1. Google Search Console

1. https://search.google.com/search-console öffnen, mit Google-Account anmelden.
2. **Property hinzufügen** → **Domain** (nicht "URL-Präfix" — Domain deckt automatisch www-, http-, https- und alle Subdomains ab).
3. `deutsche-deadlock-community.de` eingeben → **Weiter**.
4. Google zeigt einen TXT-Record-Wert (`google-site-verification=...`).
5. Diesen TXT-Record beim DNS-Provider der Domain eintragen:
   - Type: `TXT`
   - Host/Name: `@` (oder leer)
   - Value: der von Google angezeigte String
   - TTL: Default
6. 1–10 Minuten warten, dann in der Search Console **Verifizieren** klicken.
7. Nach erfolgreicher Verifikation: links auf **Sitemaps** → URL `sitemap.xml` eintragen → **Senden**.

### 2. Bing Webmaster Tools

1. https://www.bing.com/webmasters öffnen, mit Microsoft- oder Google-Account anmelden.
2. **Site importieren** → Google Search Console verknüpfen → Domain wählen.
3. Bing übernimmt Verifikation + Sitemap automatisch aus GSC.

### 3. IndexNow-Key (bereits eingerichtet)

- Key-Datei: `dl-landing/public/3ae873446cc311b7f9a7064d27668abf.txt`
- Wird mit jedem Build deployed unter `https://deutsche-deadlock-community.de/3ae873446cc311b7f9a7064d27668abf.txt`
- Validiert die IndexNow-Submissions automatisch.

## Wiederkehrend nach jedem Deploy

```bash
# 1. Sitemap mit aktuellen lastmods bauen (vor dem Vite-Build):
node scripts/build-sitemap.mjs

# 2. Subprojekte builden + deployen wie gewohnt
# (dl-landing/deploy_iis.ps1 etc.)

# 3. Nach Deploy: IndexNow-Ping (Bing + Yandex + Cloudflare-Crawler reagieren in Minuten)
node scripts/seo-submit.mjs --apply
```

Google indexiert NICHT über IndexNow. Für Google:
- Sitemap einmal in GSC einreichen (Schritt 1.7) — danach crawlt Google sie automatisch alle paar Tage.
- Akute Updates: GSC → URL-Prüfung → Indexierung beantragen.

## Troubleshooting

- **`seo-submit.mjs` sagt "Kein IndexNow-Key-File":** Key-Datei muss in `dl-landing/public/` liegen, Name = 32-Hex-Char + `.txt`.
- **HTTP 422 von IndexNow:** Key-File ist nicht unter dem deklarierten URL erreichbar — prüfen ob `https://deutsche-deadlock-community.de/<key>.txt` geht.
- **HTTP 429 von IndexNow:** Rate-Limit, einfach 5 Minuten warten.
