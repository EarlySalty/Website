# Website-Vereinheitlichung + Rank-History-Dashboard (Grillme 2026-07-03)

Ergebnis der Grillme-Session. Ziel: alle Seiten auf das edle Art-Déco-Design
(deco-elevator-new + dl-coaching) ziehen, gemeinsame Navigation, SEO sauber,
und das Aktivitäts-Dashboard um Rank-History erweitern.

## Entschieden

1. **Root-Swap:** `deco-elevator-new` ersetzt `dl-landing` unter `/`.
   Die Elevator-Etagen werden echte Unterseiten mit `<a href>`-Links
   (SEO: eigene Titles/Descriptions pro Thema). Swap erst, wenn die
   Unterseiten stehen — keine toten Deep-Links.
2. **Scope-Ausnahmen:** `/streamer` (eigene Seite, gezielter Umbau später)
   und `/tierlist` (wird neu gemacht) bleiben unangetastet.
   `/patch` hat das neue Design bereits.
3. **Brand-Paket `dl-brand/`** als einzige Quelle der Wahrheit:
   `tokens.css` (Farben/Gold/Grain/Schatten aus Elevator+Coaching harmonisiert),
   Fonts (Sora/Manrope), Nav-Panel, Footer, Logo. Auslieferung via Caddy
   unter `/brand/*` — eine Änderung wirkt sofort auf allen Seiten.
4. **Logo:** Das Coaching-Logo (`deadlock-d-logo.png`) ist das **einzige**
   Logo der Gesamtmarke (Header + Favicon überall). Alle anderen Logos
   (Elevator `ddc-logo.svg` etc.) fliegen raus.
5. **Navigation („Tab"):** Schwebender Aufzug-Ruf-Knopf auf jeder Seite,
   öffnet Etagen-Panel mit echten Links:
   Empfang `/`, Mitspieler `/mitspieler/`, Coaching `/coaching/`,
   Aktivität & Ränge `/aktivitaet/`, Patchnotes `/patch/`, Helden `/helden/`,
   Streamer `/streamer/`, Beitreten `/beitreten/`.
   Volles Elevator-Erlebnis nur auf der Startseite. Zusätzlich schlanker
   Footer mit Text-Links auf jeder Seite (Crawler-Futter). Feinschliff später.
6. **Rank-History (Daten: `steam.steam_rank_history`, zentrale PG):**
   - Eigener Verlauf nur nach Discord-Login (bestehender OAuth-Flow von
     `/aktivitaet/`).
   - **Sichtbarkeits-Einstellung pro User:** `privat` (Default) /
     `nur Server-Mitglieder` / `öffentlich`. Serverseitig gespeichert.
   - **Rang-Leaderboard** auf `/aktivitaet/` (wie Voice/Text): Sortierungen
     „Top Climber" (Δ Badge-Level über 30 Tage, **inkl. Absteiger** — bei
     Negativ-Trend Coaching-Pitch mit Link auf `/coaching/`) und
     „Top-Ränge" (aktuelles Badge-Level).
   - Betrachterabhängige Filterung: anonym → nur `öffentlich`;
     eingeloggtes Server-Mitglied → zusätzlich `Mitglieder`-Stufe.
     Filterung serverseitig.
   - Klick auf Leaderboard-Eintrag klappt die Rangkurve der Person auf
     (gleiche Chart-Komponente wie eigener Bereich).
   - Private/unbekannte Profile liefern identische Antworten
     (kein Enumerieren möglich).
   - Kein Profil-URL-Verzeichnis; Auffindbarkeit läuft über das Leaderboard.
   - Eigener Bereich: Rang-Karte (Badge/Name/Subrank), Kurve mit
     30/90/alles-Umschalter in Rang-Farben, W/L falls Daten da,
     Sichtbarkeits-Schalter.
7. **SEO-Welle (mit Root-Swap):** `noindex` der neuen Seite entfernen,
   Sitemap, Canonicals, Titles/Descriptions pro Unterseite, Redirects für
   sterbende URLs, interne Verlinkung via Nav-Panel + Footer.
8. **dl-coaching** bindet das Brand-Paket zuletzt ein (ist das Vorbild).

## Phasen

1. `dl-brand` Paket (Fundament)
2. `dl-activity` Restyle
3. Rank-History Backend (`dl-stats`, Port 8768, Session-Auth vorhanden)
4. Rank-History UI in `/aktivitaet/`
5. Unterseiten neu (Mitspieler, Helden, Beitreten, Guides — ersetzen oder
   übernehmen+verbessern)
6. Root-Swap + SEO-Welle
7. dl-coaching Brand-Anbindung

## Technische Anker

- Backend-Heimat: `Deadlock-Bots/rust/crates/dl-stats` — hat PgPool auf
  zentrale PG, `require_session`, bedient bereits `/aktivitaet/api/*`
  (Caddy → 127.0.0.1:8768).
- `steam.steam_rank_history(user_id, badge_level, rank_name, captured_at)`.
- Sichtbarkeit: neue Migration in `dl-central-db` (+ fresh==prod-Test).
- Mitglieder-Check: bestehende Member-Daten der zentralen PG.

## Vorfall am Rande

`dl-patch`-Redesign und Elevator-Iteration lagen **uncommittet** im
Working Tree (live via gitignoretem `dist/`). Als `wip:`-Commits auf
`redesign/website-vereinheitlichung` gesichert (ace0249, a3b91a5).
