# Landing-Page Redesign

## Ziel
Die Hauptseite deutsche-deadlock-community.de zum Aushängeschild der Community machen – stylisch, klar navigierbar, alle Community-Tools sauber erreichbar.

## Status
**In Bearbeitung** – HTML-Worker 1 fertig, CSS/JS offen (2026-04-13)

## Aufgaben

### HTML (alle 4 Seiten: index, mitspieler, coaching, streamer)
- [x] Logo → „Deutsche Deadlock Community" als Gradient-Text
- [x] Header umstrukturieren: Hamburger links | Logo | Beitreten rechts
- [x] Nav-Drawer HTML einbauen (Slide-In von links, alle Links strukturiert)
- [x] Services-Hub-Sektion entfernen (nur index.html, Zeilen 232–274)
- [x] Footer auf 4 Spalten (neu: Plattformen + AGB im Rechtliches-Block)

### CSS (site.css)
- [x] `.menu-button` immer sichtbar (kein `display: none` mehr)
- [ ] `.nav-links` im Header entfernen (nav-drawer übernimmt)
- [x] Nav-Drawer CSS hinzufügen (Backdrop, Panel, Labels, Links)
- [x] Footer-Grid auf 4 Spalten, Responsive anpassen
- [x] Button-Shadow: `rgba(255,122,24,...)` → `rgba(6,182,212,...)`
- [x] Button-Border-Fix: `border: none` auf Primary-Button

### JS (site.js)
- [x] `setupMobileMenu` → `setupNavDrawer` mit is-open Klasse, Backdrop-Click, Escape

## Fortschritt
- 2026-04-13: Worker 2 hat `src/site.css` und `src/site.js` für den neuen Nav-Drawer, Footer-Grid und Button/Header-Fixes umgesetzt.
- 2026-04-13: Nav-Fix linksbündig in `src/site.css` ergänzt, Domains in `mitspieler/`, `coaching/` und `streamer/` aktualisiert sowie `public/robots.txt` und `public/sitemap.xml` für die saubere Build-Ausgabe angepasst; Build/Verifikation erfolgreich.

## Entscheidungen
- Drawer slide-in von links, Backdrop-Click schließt ihn
- Discord-Link: `https://discord.gg/z5TfVHuQq2`
- Rechtliches Footer: `/twitch/impressum`, `/twitch/datenschutz`, `/twitch/agb`
- Nav-Drawer Struktur: Community (Start/Mitspieler/Coaching) | Streamer (Netzwerk/Onboarding/FAQ) | Plattformen (Turnier/Aktivität/Builds)

## Relevante Dateien
- `/home/naniadm/Documents/Website/dl-landing/index.html`
- `/home/naniadm/Documents/Website/dl-landing/mitspieler/index.html`
- `/home/naniadm/Documents/Website/dl-landing/coaching/index.html`
- `/home/naniadm/Documents/Website/dl-landing/streamer/index.html`
- `/home/naniadm/Documents/Website/dl-landing/src/site.css`
- `/home/naniadm/Documents/Website/dl-landing/src/site.js`

---
*Vorheriger Workflow (SEO & Bild-Fix) → abgeschlossen, wurde durch diesen ersetzt*
