# Auftrag: Navigationsleiste und Coaching-Anfrage-Formular überarbeiten

Seite: deutsche-deadlock-community.de/coaching/anfrage (Coaching-App im Website-Repo). Farbwelt (Schwarz, Gold, Raster) bleibt unverändert. Der Nutzer findet die obere Leiste hässlich und das Formular nicht überzeugend.

## Regeln

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Eigener Worktree unter `~/.worktrees/Website-coaching-redesign`, Branch `feat/coaching-redesign`. Nie im geteilten Checkout `~/repos/Website` arbeiten.
- Keine Code-Kommentare. Rust ist Pflicht für Backend-Code, kein neues Python.
- Sichtbare Texte auf Deutsch mit echten Umlauten, keine Em-Dashes, nicht "bottig".
- Vor jeder Codesuche zuerst Graphify (Skill `code-suche`).
- Nach dem Bauen Seite per Screenshot selbst prüfen (Desktop und mobil), betroffene Seiten durchklicken.
- Abschluss nach `orchestrierung/ABLAUF.md`: Merge-Gate (`gate_hook.py --review`) gegen die eigene Arbeit, dann Merge nach main, Push (`HEAD:main`, Git-Schritte einzeln), Deploy, Live-Prüfung, Branch und Worktree löschen, Thread settlen. Der Fixer prüft sich vor der Fertigmeldung selbst.
- Intent-Thread-ID: die aufrufende Hauptsession (Orchestrator), Bump-up per `[Bump-up]`-Nachricht.

## Teil 1: Obere Leiste (alle Coaching-Seiten)

Befund: neun Links in Großbuchstaben mit enger Laufweite, zweizeilige Labels ("MEIN COACHING", "SCRIM-POOL"), der Nutzer-Chip überlappt "SCRIM-LAGE", Logout hängt lose rechts.

- Öffentliche Hauptlinks auf 3 bis 4 kürzen (Coaches, Anfrage, Scrims).
- Mein Coaching, Mein Team, Coach-Bereich, Scrim-Pool, Scrim-Lage und Logout in ein Avatar-Dropdown, rollenabhängig sichtbar wie bisher.
- Alle Labels einzeilig, weniger Laufweite, aktiver Eintrag als Goldlinie oder Pille.
- Ein goldener Haupt-Button rechts "Coaching anfragen".
- Leiste sticky, leichter Blur, Haarlinie in Gold unten, keine Überlappung bei jeder Breite, mobil ein sauberes Menü.

## Teil 2: Formular `/coaching/anfrage`

Befund: natives Datumsfeld zeigt US-Format `mm/dd/yyyy`, Eingaben dunkel auf dunkel mit schwachem Kontrast, alle Labels winzig in Versalien mit Sternchen, Button wirkt deaktiviert, viel toter Raum.

- Rang: Auswahl mit Rang-Symbolen und Stufe statt Freitext.
- Main-Hero: durchsuchbares Raster mit Heldenporträts.
- Wunschzeit: Chips ("Heute Abend", "Morgen", "Wochenende") plus deutsches Datum- und Zeitfeld, mehrere Zeitfenster erlaubt.
- Games / Stunden: aus verknüpften Steam- oder Deadlock-Daten vorbefüllen, wenn vorhanden, sonst Eingabe. Nur umsetzen, wenn eine Datenquelle im Code schon existiert; sonst Eingabe belassen und im Report vermerken.
- Verbessern: Mehrfach-Chips (Laning, Farming, Teamfights, Build-Entscheidungen, Replay anschauen), Freitext optional.
- Formular als erhabene Karte mit Goldkante, größere Überschrift links, bestehende Backend-Schnittstelle und Pflichtfelder unverändert lassen (keine API-Brüche).
- Goldener, immer aktiver Senden-Button, Validierung inline, echter Erfolgszustand nach dem Absenden.
- Keine erfundene Zusage wie "Antwort in 24 Stunden", nur Aussagen, die der Code einlöst.

## Abweichungen

Ist etwas nicht baubar oder weicht der Code ab, als `ABWEICHUNG:` melden statt es passend zu biegen.
