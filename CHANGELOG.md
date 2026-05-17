## #21 — Logo und Metadaten auf aktuelle Brand-Version gebracht

- Logo (ddc-logo.svg) auf die aktuelle Referenz-Version aus dem Design-System aktualisiert
- alternateName im strukturierten Schema-Markup ausgeschrieben statt abgekürzt

## #20 — Feedback-Seite für ehemalige Mitglieder

- Neue Seite, auf der ausgetretene Discord-Mitglieder in Ruhe ausführliches Feedback geben können — mit Textfeldern und optionalem Bild-Upload
- Die Fragen sind darauf abgestimmt, wie lange und wie aktiv jemand dabei war
- Erreichbar nur über einen persönlichen Link und nur einmal absendbar

## #19 — Repo-Aufräumen ohne sichtbare Änderung

- Build-Abhängigkeiten (`node_modules`) sind nicht mehr im Git getrackt — das Repo wird beim nächsten Update spürbar schneller geklont und aktualisiert
- Für Besucher der Website ändert sich nichts

## #18 — Discord-Buttons jetzt pro Bereich getrennt messbar

- Jede wichtige Subseite der Website nutzt jetzt ihren eigenen Discord-Einstiegslink statt eines gemeinsamen Buttons
- Damit wird sichtbar, ob neue Member eher über Startseite, Streamer, Mitspieler, Coaching, Helden oder Guides in den Discord kommen

## #17 — Trivy-Scan für vollständige Code-Scanning-Abdeckung

- Trivy-Filesystem-Scan ergänzt: Sicherheitslücken in Abhängigkeiten erscheinen jetzt in GitHub Security / Code Scanning
- Findings (HIGH/CRITICAL) aus allen Scantools sichtbar in einer zentralen Oberfläche

## #16 — API-Endpoint-Inventar und Dependency-Pinning

- Neuer CI-Job listet alle FastAPI-Endpunkte und warnt bei Admin-Routen ohne sichtbaren Auth-Schutz
- Route-Inventar wird als 90-Tage-Artifact gespeichert — Änderungen zwischen PRs direkt vergleichbar

## #15 — DAST, Lizenz-Audit und Security-Header-Check

- Wöchentlicher OWASP ZAP Baseline-Scan gegen die Live-Website eingerichtet — findet Lücken die statische Scans nicht sehen
- Neuer Security-Header-Check: HSTS, X-Content-Type-Options und X-Frame-Options werden wöchentlich überprüft
- Lizenz-Audit prüft alle Python-Abhängigkeiten auf Copyleft-Lizenzen (GPL/AGPL)

## #14 — GitHub Actions Minutenverbrauch drastisch gesenkt

- Tägliche Security-Scans entfernt — werden stattdessen wöchentlich vom Remote-Agent abgedeckt
- Semgrep meldet Findings jetzt als Info statt den Build abzubrechen — kein falscher Alarm mehr
- Dependabot-Auto-Merge läuft nur noch bei echten PRs, nicht mehr täglich auf Vorrat

## #13 — Automatische Security-Pipeline vervollständigt

- Dependabot überwacht jetzt auch das Python-Backend täglich auf neue Versionen
- Bei jedem Push werden alle npm- und pip-Abhängigkeiten automatisch auf CVEs geprüft
- Jeder Release wird kryptografisch signiert (SBOM + Provenance-Attestierung via Sigstore)

## #12 — Sicherheitslücken in Abhängigkeiten geschlossen

- Backend-Pakete (FastAPI, Pydantic, python-jose, python-multipart) auf aktuelle, sichere Versionen aktualisiert — schließt u.a. eine JWT-Fälschungs-Lücke und Path-Traversal in Datei-Uploads
- Frontend-Abhängigkeiten (vite, rollup, picomatch, postcss) auf gepatchte Versionen angehoben

## #11 — Backlinks von eigenen Bot-Repos und Paste-Vorlagen

- README in den vier eigenen Bot-Repos (Deadlock-Bots, Patchnotes-Bot, Steam-Bot, Twitch-Bot) bekommt jetzt automatisch einen Footer-Block mit Link zur Website, Discord und Helden-Übersicht
- Ein Befehl reicht — alle Repos werden gleichzeitig aktualisiert und gepusht, idempotent
- Für Discord-Server-Description, Twitch-Panels und Steam-Group-Summary gibt es fertige Copy-Paste-Texte zum Einfügen

## #10 — Helden-Übersicht und Anfänger-Guide auf Deutsch

- Neue Seite `/helden/` zeigt alle 38 Deadlock-Helden mit Portrait, Lane-Zuordnung, Rolle und Schwierigkeitsgrad
- Filter nach Anfänger/Fortgeschritten/Schwer und nach Rolle (Carry, Mage, Tank, Initiator, Support, Skirmisher, Defender)
- Neue Seite `/guides/anfaenger/` ist ein vollständiger deutscher Einsteiger-Guide: Match-Aufbau, Lanes, Souls, Items, Hero-Empfehlungen, wichtige Mechaniken und häufige Fehler
- Beide Seiten in Hauptnavigation, Footer und auf der Startseite verlinkt — sauber für Google indexierbar
- Sitemap deckt jetzt 9 statt 7 URLs ab

## #9 — Website-Joins werden jetzt sauber gezählt

- Alle "Discord beitreten"-Buttons auf der Website laufen jetzt über einen eigenen Tracking-Invite
- Im Discord lässt sich mit einem Befehl auswerten, wie viele Member über die Website kommen — unabhängig von Discord-Listings, persönlichen Einladungen und Twitch-Streamern
- Vanity-URL (discord.gg/z5TfVHuQq2) bleibt für Direkt-Eingaben und externe Listings als Backup erhalten

## #8 — "Live aus der Community"-Sektion auf der Startseite

- Neue Sektion direkt unter dem Hero zeigt drei Live-Kacheln: aktive Voice-Lanes mit Live-Personenzahl, eine Avatar-Wand der gerade-online-Spieler und eine Patchnotes-Kachel
- Voice-Lane-Kachel listet die Top 5 belebten Lanes mit Personenzahl pro Lane — direkt aus dem Discord, ohne Refresh
- Online-Wand zeigt 16 Avatare plus Overflow-Counter ("+X"), damit man sieht wie viele wirklich da sind
- Sortiert die Lanes nach Aktivität, blendet Server-Helper-Channels (AFK, Sammelpunkt, Coaching-Lane) aus
- Skeleton-Loading damit nichts springt während die Daten laden, Fallback wenn Discord mal nicht antwortet

## #7 — Hero-Polish und Live-Indikator auf den Subseiten

- Hero-Überschrift erscheint jetzt mit weichem Wort-für-Wort-Effekt beim Laden
- Hauptbutton zieht den Mauszeiger sanft an — kleines Premium-Detail
- Hero-Hintergrund hat einen feinen Filmkorn-Layer und wärmeren Farbverlauf
- Coaching-, Mitspieler- und Streamer-Seite zeigen jetzt rechts oben einen kleinen Live-Indikator mit "X online" — direkt aus Discord
- Respektiert Reduzierte-Bewegung-Einstellungen, mobil bleibt der Header schlank

## #6 — Suchmaschinen-Ping nach jedem Deploy

- IndexNow eingerichtet: Bing, Yandex und Cloudflare-Crawler erfahren jetzt in Minuten von neuen oder geänderten Seiten — nicht erst nach Tagen
- Ein-Schritt-Befehl `node scripts/seo-submit.mjs --apply` schickt die ganze Sitemap nach jedem Deploy raus
- Operator-Anleitung für das einmalige Google Search Console und Bing Webmaster Tools Setup liegt jetzt im Repo

## #5 — Bessere Auffindbarkeit bei Google & Live-Discord-Zahlen

- Mitgliederzahl und gerade-online-Spieler werden jetzt live auf der Startseite angezeigt (zieht direkt aus dem Discord-Server)
- Vollständige Link-Vorschauen beim Teilen — auch für Patchnotes und Aktivitäts-Tracker — mit Bild, Titel und Beschreibung
- Sitemap erweitert: Patchnotes, Aktivitäts-Tracker, Builds, Mitspieler, Coaching und Streamer-Bereich sind jetzt sauber für Google sichtbar
- Domain-Weiterleitung von `www.` auf die normale Domain repariert (war noch auf eine alte Adresse gestellt)
- Strukturierte Daten ergänzt, damit Google die Seite als deutsche Deadlock-Community samt Coaching-Angebot erkennt

## #4 — Automatische Dependency-Updates eingerichtet

- Dependabot überwacht ab jetzt alle GitHub Actions und npm-Pakete in allen Teilprojekten auf veraltete Versionen
- Dependabot-PRs werden automatisch gemerged, sobald keine Workflow-Dateien betroffen sind
- Keine manuelle Arbeit mehr für Routine-Dependency-Updates

## #3 — Tierliste: aufgeräumter Header, neue Tier-Farben, weniger leere Seiten

- Großer Hero-Header oben raus — Patch und Aktualisierungs-Datum stehen jetzt klein und dezent direkt im Seiten-Header
- Suchleiste und Grid/List-Umschalter sitzen kompakt in einer Zeile statt in einer eigenen Karte
- Neue, intuitivere Tier-Farben: S+ rot, S orange, A grün, B blau, C grau — statt der bunten Mischung vorher
- Fix: Seite blieb manchmal leer und ging erst nach STRG+F5 wieder — jetzt revalidiert der Browser die Hauptseite bei jedem Aufruf, Bilder/Code werden langfristig gecacht
- Fallback bei kurzem Backend-Aussetzer lädt jetzt korrekt die zwischengespeicherten Daten statt 404

## #2 — Tierliste live auf deutsche-deadlock-community.de/builds

- Neue Tierliste ist jetzt direkt unter `deutsche-deadlock-community.de/builds` erreichbar und ersetzt die alte manuelle Builds-Seite
- Verlauf und Admin-Bereich liegen unter `/builds/history` und `/builds/admin`
- Alle 38 Hero-Portraits werden lokal ausgeliefert — keine Platzhalter mehr
- Discord-Login auf der Admin-Seite leitet sauber zurück nach `/builds/admin`

## #1 — Tierlist: automatische Meta-Einteilung statt manueller Pflege

- Tierliste auf `dl-tierlist` baut sich jetzt automatisch aus den aktuellen Winrates pro Hero
- Drei Skill-Stufen wählbar: All Skill, Phantom+, Eternus — jede mit eigener Tier-Liste
- Klick auf einen Hero zeigt direkt Beschreibung, empfohlene Builds (mit 👍 / 👎) und Twitch-Streamer
- Verlauf-Seite zeigt die letzten 30 Tier-Stände und hebt Tier-Wechsel hervor
- Neues Admin-UI fürs Pflegen von Beschreibungen, Streamern, Schwellen, Refresh-Intervall und Patch-Override
