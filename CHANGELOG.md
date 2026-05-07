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
