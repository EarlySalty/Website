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
