# Website SEO & Bild-Fix

## Ziel
- Website besser in Google gelistet für "Deutsche Deadlock Community" etc.
- Verzerrte Bilder auf earlysalty.de beheben
- DLDC.PNG als neues og:image einsetzen

## Status: ✅ Erledigt

## Durchgeführte Änderungen

### 1. CSS-Bildverzerrung behoben
- `.server-preview-visual img` in `src/site.css`: `object-fit: cover` und `height: 340px` hinzugefügt
- Betrifft alle Seiten mit Server-Vorschau (Startseite, /mitspieler/, /coaching/)

### 2. SEO-Tags hinzugefügt
Alle 4 Seiten (index, mitspieler, coaching, streamer):
- `<meta name="keywords">` mit seitenspezifischen Keywords
- `<meta property="og:image">` (1200x630)
- `<meta property="og:image:width/height">`
- `<meta name="twitter:card">` (summary_large_image)
- `<meta name="twitter:title/description/image">`

### 3. og:image erstellt
- DLDC.PNG (356x1116) → auf 1200x630 gecroppt (Mitte)
- Gespeichert in: `public/images/og-image.png` → `dist/images/og-image.png`

## Verifiziert
- [x] Build erfolgreich (`npm run build`)
- [x] og:image in dist/images/
- [x] SEO-Tags in dist/index.html
- [x] CSS mit object-fit in dist/assets/site-BknARHhI.css

## Nächste Schritte
- Website deployen (dist/ auf Server)
- Google Search Console prüfen
- Eventuell DLDC.PNG als Ersatz für discord-channels.png wenn gewünscht
