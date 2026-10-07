# Deadlock-Welt und Suchbegriffe für die Community-Website

[Orchestrator] Auftrag vom 7. Oktober 2026. Hauptsession: 54761527-aad1-4c60-8a2c-4e9182b13cef. T3-Auftrag/Anhänge: 57fef9cc-b651-4531-80b5-241500094926.

## Nutzerziel

Die Deutsche Deadlock Community soll eine bildgewaltige, lebendige Website bekommen, die sich wirklich wie Deadlock anfühlt. Explizite Vorbilder: https://www.playdeadlock.com/oldgods und https://www.playdeadlock.com/cityneversleeps . Der Nutzer erlaubt, den thematischen und gestalterischen Stil eng daran auszurichten. Er hat mehrfach „weiter“ gesagt. Er will keine weitere Konzeptschleife und keinen generischen Schwarz-Gold-Kartenanstrich. Zugleich sollen die vorhandenen Seiten zu den echten Suchbegriffen aus seiner Search Console passen. Er verweist ausdrücklich auf Steam-Patch-History und Discord-Spielvorschau als Bildquellen und hat vier konkrete hochwertige Spielbilder beigefügt.

## Rolle und Eigentum

Du bist alleiniger Implementierer und Integrator dieses eng gekoppelten Website-Pakets, Modell sol gemäß `t3-thread.py pyramide worker_gross` am 07.10.2026. Keine weiteren Bau-Threads oder Teil-Orchestratoren starten. Arbeite im eigenen Worktree `/home/nathanael/.worktrees/website-deadlock-world-20261007`, Branch `feat/deadlock-world-seo-20261007`, Basis origin/main dbd2b34. Der Kanon `/home/nathanael/repos/Website` hat fremde ungetrackte `dl-brand/social-preview/`, diese nicht anfassen. Andere Worktrees nicht ändern oder löschen. Hauptsession schreibt REGISTER.md; du führst fachliche Belege, DESIGN.md, PRODUCT.md, REVIEW.md und REPORT.md. Der gesamte Auftrag wird umgesetzt und nach bestehenden Gates abgeschlossen, nicht nach einer bloßen Planung beendet.

Keine Code-Kommentare schreiben. Bestehende Kommentare nicht ausweiten. Keine Secrets lesen, ausgeben oder speichern. Keine ENV-Dateien. Bestehende statische HTML/CSS- und Frontend-Bausteine weiterverwenden; kein neuer Backend-Dienst und keine neue Node/Python-Laufzeit. Sollte serverseitige Logik erforderlich werden, ausschließlich Rust. Keine DB-Änderungen für diese Aufgabe. Keine PRs oder GitHub Actions.

## Bereits festgestellter Bestand

Graphify zuerst genutzt: global und im Website-Repo. Du musst vor eigenen Code-Suchen `code-suche` laden und Graphify befragen. Nicht von geratener Landing-Datei ausgehen.

Die laufende Startseite stammt aus `deco-elevator-new/index.html`, mit `styles.css`, `script.js`, Assets unter `/new/`. `dl-landing/index.html` ist nicht die tatsächlich ausgelieferte Startseite. Mitspieler und Beitreten liegen unter `dl-landing/mitspieler/index.html` und `dl-landing/beitreten/index.html`, Vite-MPA nach `dl-landing/dist`. Coaching läuft aus `dl-coaching`, React, insbesondere `src/pages/CoachesPage.tsx` und gemeinsamem Layout. Nicht die alte `dl-landing/coaching/index.html` bearbeiten. Patch läuft aus `dl-patch`. Gemeinsame Marke: `dl-brand/tokens.css`, `nav.css`, `nav.js`, Fonts, Logo. Tatsächliche Caddy-Routen und Deploy vor Änderungen verifizieren.

Vorarbeit existiert:
- Branch `codex/seo-search-intents-20260930`, SHA 2a0a1ae, Worktree `/home/nathanael/.worktrees/website-seo-search-intents-20260930`. Bericht `.tasks/2026-09-30-seo-search-intents/REPORT.md`. 22 Dateien, unter anderem statisches Coaching-HTML, Metadaten, SEO-Artefaktprüfungen. Nicht blind alten Branch mergen. Gegen frisches main prüfen und nur noch fehlenden Eigenanteil gezielt integrieren. Dortige Claims und Testbelege sind Altstand, nicht dein Fertigbeweis.
- Branch `paket-d/website-brand-20260930`, Worktree `/home/nathanael/.worktrees/paket-d-website-brand-20260930`. Nur bei Relevanz lesen. Fremde Arbeit erhalten.
- `docs/redesign-2026-07-website-vereinheitlichung.md` und `dl-landing/WORKFLOW.md` dokumentieren frühere Umbauten. Nutzer möchte jetzt echten Deadlock-Stil, nicht deren alten generischen Look konservieren.

## Bildmaterial und visueller Auftrag

Die vier Nutzerbilder wurden von der Hauptsession visuell geprüft. Alle 2560×1440. Originale niemals verändern oder entfernen. Aus ihnen lokale optimierte Varianten erzeugen und Quellzuordnung dokumentieren:
1. `/home/nathanael/.t3/userdata/attachments/57fef9cc-b651-4531-80b5-241500094926-e1a880b2-1661-4306-a735-f7e913ed5203.png`: nächtliche Stadt, großer Rattencharakter rechts, blaue Himmelsöffnung links/mittig, warm beleuchtete Architektur. Starkes Hero-Motiv mit Text links. Nicht durch dunkles Overlay komplett töten.
2. `/home/nathanael/.t3/userdata/attachments/57fef9cc-b651-4531-80b5-241500094926-621564fb-6fb4-4bd9-982d-dcdec265b635.png`: Held vor Nachtclub und Stadt, Figur mittig/rechts, Neon und Mondlicht. Großes zweites Szenenmotiv.
3. `/home/nathanael/.t3/userdata/attachments/57fef9cc-b651-4531-80b5-241500094926-28b41f55-8fe5-40a9-8ff9-ee8d69612804.png`: kräftiger schnauzbärtiger Held rechts in warmer Industriegasse, links ruhige Fläche. Gut für Mitspieler/Coaching-Einstieg.
4. `/home/nathanael/.t3/userdata/attachments/57fef9cc-b651-4531-80b5-241500094926-98f21c4c-e649-4626-b443-bef91a389447.png`: leuchtender blauer Geist in dunkler Ladenpassage, ungewöhnlicher enger Anschnitt. Als atmosphärischer Abschnittsübergang, nicht erzwungen als Personenportrait.

Keine Wasserzeichen entfernen. Keine privaten Discord-Bilder/Nutzernamen veröffentlichen. Die Spielvorschau im offiziellen Discord ist ein Recherchehinweis, kein Anspruch, dass unser Community-Bot dort Zugriff hat. Unser `list_channels` zeigt keinen Kanal Spielvorschau. Direkte frei zugängliche Valve-/Steam-Quellen und die beigefügten Bilder reichen, fehlenden Discord-Zugriff nicht durch Konten-/Tokenbastelei kompensieren.

Valve-Quellen sind empirisch geprüft. Die Seiten sind client-gerendert: bloßer HTML-/Markdown-Abruf zeigt nur den Titel, nicht das Design. JS/CSS-URLs aus deren HTML mit vollständigem Querystring lesen; nackte main.js/css liefern nicht die brauchbare Fassung. Geladene Route-Chunks:
- `https://www.playdeadlock.com/public/javascript/react/333.js?contenthash=b34c79d4efb4b3652966` Old Gods.
- `https://www.playdeadlock.com/public/css/react/333.css?contenthash=d93c2f5faa9f582a25f0` Old Gods.
- `https://www.playdeadlock.com/public/javascript/react/38.js?contenthash=c28850c16ac7d5b4174d` City Never Sleeps.
- `https://www.playdeadlock.com/public/css/react/38.css?contenthash=4bbcde128f95ba2ed180` City Never Sleeps.
Diese Hashes bei Bedarf frisch aus manifest.js lösen.

Visuelle Evidenz aus CSS: Oracle und Pulp, City zusätzlich Jost. Papierweiß #fff1dc/#f7e9d5, fast schwarze Flächen #070707, kräftiges Rostorange #da5a29/#dd6638, Stadtbereiche mit eigenem Blau/Grün/Gelb. Reale Bild-/Texturpfade:
- `https://cdn.akamai.steamstatic.com/apps/deadlock/images/react/oldgods/bg_texture.jpg`, `bg_texture_dark.jpg`, `scratch_mask_top.png`, `header_heroes.png`.
- `https://cdn.fastly.steamstatic.com/apps/deadlock/images/react/cityneversleeps/header_city.webp`, `header_portraits.webp`, `lane_grain.jpg`, `skyline_blue.webp`, `skyline_green.webp`, `skyline_yellow.webp`, `scratch_edge.png`, `locals_bg.jpg`, `grain.jpg`.
Weitere tatsächliche Szeneassets aus dem JS: uptown_02.webp, times_square_05.jpg, broadway_01.jpg, central_park_01.webp, factory_02.webp, seaport_01.jpg.
- Font-URLs existieren unter `https://cdn.fastly.steamstatic.com/apps/deadlock/fonts/VALVEOracle-Medium.woff2`, `VALVEPulp-Bold.woff2`, Jost-TTFs. Öffentlich abrufbar bedeutet nicht automatisch frei lizenzierbar. Für Weiterverteilung eigener Fonts/Assets Herkunft/Nutzungsbasis prüfen; bei unklarem Font-Recht vorhandene lizenzierte bzw. offene charakterstarke Alternative einsetzen, nicht die Aufgabe daran blockieren. Kein pauschales Lizenzversprechen.

Gestalterische Festlegung: cineastische okkulte Großstadt, kräftige plakative Überschriften, großes echtes Artwork, Papier-/Drucktextur und unregelmäßige Übergänge sparsam, erkennbare Community-Marke, Schwarz/Elfenbein/Gold mit Farbe AUS dem Artwork. Vollflächige Bildkapitel und asymmetrische Komposition, keine austauschbare SaaS-Kachelwand, keine Emoji-Icons, kein zufälliges Neon-Glow, keine Pastellfilter. Das Motiv führt, Text und Beitritt bleiben auf dem ersten Bildschirm auffindbar. Kein erfundenes Spielwissen oder fiktionales Portal-Rollenspiel in der Benutzerführung. Deutsche Community erkennbar, keine Nachahmung einer offiziellen Valve-Seite. Game-/Markenhinweis im Footer beibehalten oder korrekt ergänzen.

`impeccable` laden und Vorgaben erfüllen: context.mjs einmal im eigenen Kontext mit echter Zieldatei, new-work und unmittelbar vor UI-Bau craft-floor lesen. Das Projekt hat noch kein PRODUCT.md/DESIGN.md; aus dem expliziten Auftrag und belegtem Bestand knapp dokumentieren, keine erneute Stilbefragung nötig. Frontend-Text über no-em-dashes, humanizer und relevante Schreibskills, echte Umlaute. Keine unbelegten Superlative wie „aktivste“, keine garantierten Sofort-Mitspieler, keine erfundenen Zahlen/Testimonials.

## Umfang und Nutzerfluss

Zusammenhängend fertigstellen:
- Startseite `/`: vollständiger Redesign als große Community-Landing, Hauptziel Discord beitreten/Mitspieler finden. Eigene klare H1 „Deutsche Deadlock Community“ in natürlicher Komposition; markante kurze Einladung darf daneben stehen. Visuelle Reise mit Stadt/Helden, Zugang zu Mitspielern, Coaching, Patch-Verlauf; vorhandene Live-Daten nur mit ehrlichen Zuständen. Mehr Originalbilder statt generischer Illustration.
- `/mitspieler/`: identischer visueller Zusammenhang, Keyword Deadlock LFG/Mitspieler, direkte Suche/Discord-Weg, vorhandene Funktionen erhalten.
- `/beitreten/`: eindeutige deutsche Discord-Einstiegsseite im selben Look. Keine zweite Startseiten-Kopie und keine Keyword-Dopplungsseite.
- Öffentlicher Einstieg `/coaching/`: passendes starkes Bildmotiv, Keywords Deadlock Coaching/Coach auf Deutsch, bestehende Coachliste, Filter, Anfrage und Auth unverändert funktional. Keine neue App, kein neuer Backendpfad.
- `/patch/`: visuell anschließen, echte Patch-Inhalte und Quellbilder nutzen, vorhandenen Datenpfad erhalten. Nicht die gesamte Patch-App neu bauen.
- Gemeinsame öffentliche Navigation/Footer und Bild-/Typobausteine wiederverwenden. Benachbarte öffentliche Seiten (Helden, Guides, Blog) auf Verträglichkeit prüfen. Keine ungefragte Umgestaltung eingeloggter Dashboards, Bot-Oberflächen, earlysalty.de/me oder Streamer-Website aus dem Twitch-Repo. Sie können später denselben Stil bekommen, sind nicht Schreibbereich dieses Auftrags.

## Search Console und SEO

Die Screenshots belegen nur den dort unbekannten Zeitraum und Filterzustand. Keine Position/CTR-Ursache oder Ranking-Garantie daraus erfinden.

Suchbegriffe, Klicks/Impressionen: deadlock coaching 1/32; deadlock lfg 1/5; Tippfehler deadock discord 1/1; deadlock deutsch 0/187; deadlock discord 0/176; deadlock discord deutsch 0/48; deadlock coach 0/27; deadlock german 0/22; deadlock community 0/19; discord deadlock 0/14.
Seiten: `/` 42/879; `/mitspieler/` 4/98; `/faq/` 2/14; `/patch/` 1/150; `/coaching/` 1/87; `/beitreten/` 1/71. Nicht Summen beider Tabellen gegeneinander interpretieren, Suchanfragen können anonymisiert fehlen.

Suchintentionen verteilen:
- Startseite: Deadlock deutsch, deutsche Deadlock Community, Deadlock German als natürliche alternative Bezeichnung höchstens beiläufig.
- Beitreten: Deadlock Discord, Deadlock Discord deutsch, Discord Deadlock natürlich abdecken.
- Mitspieler: Deadlock LFG und Mitspieler finden.
- Coaching: Deadlock Coaching, Deadlock Coach, deutschsprachige Coaches.
- Patch: Deadlock Patchnotes auf Deutsch.

Keywords natürlich in Seitentitel, H1/H2, einleitendem Text, internen Links und passenden Beschreibungen. Kein Keyword-Stuffing, keine sinnlosen Tippfehler-Landingpages, keine Meta-Keywords. Unterschiedliche Titles/Descriptions, korrektes Canonical, OG/Twitter-Preview, semantisches HTML, Alt-Texte nur beschreibend, strukturierte Daten nur für wirklich sichtbare Inhalte. Hauptinhalt und Links ohne JavaScript lesbar, insbesondere Coaching die vorhandene SEO-Vorarbeit sinnvoll übernehmen. Sitemap/robots aus der aktuellen Crawler-Policy erhalten und konsistent bauen. Keine Suchcrawler aussperren. URLs erhalten, kein Routing-Neubau.

## Leistung und Bedienbarkeit

Lokale AVIF/WebP-Varianten mit sinnvollen mobilen Zuschnitten und Srcset/Sizes; keine 4-MB-PNGs direkt ausliefern. Ziel Hero möglichst unter 400 KB für Desktop und unter 200 KB mobil, Qualität dabei visuell prüfen. Nur Hero priorisiert, tiefe Bilder lazy. Dimensionen reservieren. Keine Hotlinks auf kurzlebige Discord-Attachments. Kein neues schweres Animationsframework. Bewegungen nur dezent über transform/opacity, prefers-reduced-motion und mobiles Verhalten sauber; kein Scroll-Hijacking, kein Autoplay-Ton. Lesekontrast und Fokuszustände, Menü per Tastatur, CTA bleibt zugänglich. Keine JS-only-unsichtbaren Inhalte bei blockierten Skripten.

## Prüfungen und Abschluss

Vor Beginn passende Startanweisungen im Repo prüfen. Builds im eigenen Worktree, keine fremden Build-Prozesse stoppen. Bestehende betroffene Suites erhalten, keine pauschale neue Testpflicht. Vor Testbehauptung rolle-test-waechter, vor Deploy rolle-deploy-verifizierer laden.

Browser: T3 `preview_open` ist in der Hauptsession gescheitert: „No preview automation host is available …“. Das ist kein UI-Beweis. Vorhandene lokale Browserstrecke benutzen, nicht blind aufgeben. `/usr/local/bin/google-chrome` und `/usr/bin/brave-browser` existieren; alter SEO-Bericht dokumentiert erfolgreiche Chromium-Tests und `/tmp/website-seo-preview/`. Vor Installation neue Abhängigkeiten zuerst nach vorhandener Playwright-Strecke suchen. Höchstens zwei gebündelte Sichtprüfungsrunden: Desktop/Mobil gemeinsam prüfen, alle Befunde gesammelt fixen, einmal bestätigen. Bilder der Vorschau dem Hauptorchestrator mit Pfaden melden. Keine monatelangen Polierschleifen.

Prüfen: fünf Routen auf 390 und 1440 px, kein horizontaler Overflow, Bilder wirklich geladen, Motive sinnvoll beschnitten, Lesbarkeit, Tastaturmenü, CTAs/Ziele und Coaching-Navigation, keine Console-Fehler. Zusätzlich SEO im tatsächlichen Build/HTTP-HTML, H1/Canonical/Meta und ohne JS. Öffentliche Nachbarseiten/Navigation dürfen nicht kaputtgehen. API-Fehler ehrlich, keine Mockdaten als Live-Nachweis.

Zentralen lokalen Merge-Gate nutzen, keine eigenen Review-Threads. Bei BLOCK frischer nativer Fixer je Runde gemäß geltender Gate-Regel, bis ALLOW oder nach fünf erfolglosen Runden echter Blockerbericht. Keine Zwischenmeldungen jeder Runde. Keine Schutz-Hooks umgehen. Nach ALLOW im autorisierten Umfang einzeln mergen/pushen, aktuelle origin/main-Artefakte über vorhandenen Website-Deployweg ausrollen, betroffene echte Dienste nur wenn nötig neu starten. Statischer Website-Deploy rechtfertigt keine Bot-Restarts. Live-Beweis: Commit/Release-Zuordnung, HTTP, wirklich geänderte visuelle Oberfläche und Funktion. Branch/Worktree erst nach Beweissicherung und erfolgreichem ancestor-Test bereinigen; Hauptregister/Briefing vorher im Repo sichern.

Abgabe in REPORT.md: Änderungen, Quellen/Asset-Provenienz, Keyword-Zuordnung, genaue Prüfkommandos und Resultate, Desktop-/Mobil-Screenshots, Gate, SHA und Live-URLs, verbleibende echte Grenzen. Pflichtzeile `MERGEPROTOKOLL[MS-1]: <n> Git-Schritte einzeln | Anläufe: <m> | Gate: <Antwort>`. Abschluss nur nach tatsächlich gemergt, deployt, live geprüft und aufgeräumt. Bei echtem Blocker Arbeit samt Belegen sichern und Hauptsession knapp informieren. Eigener Thread als allerletzten Schritt selbst settlen.
