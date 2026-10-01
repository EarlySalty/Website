# Coaching-Navigation und Anfrage

Drei öffentliche Links, goldener Anfrage-Button und Avatar-Menü ersetzen die lange Leiste. Persönliche Seiten und Abmelden liegen im Avatar-Menü, Coach-Seiten bleiben nur für Coaches und Admins sichtbar. Mobil gibt es ein eigenes Menü. Escape, Klick außerhalb und Navigation schließen die Menüs. Die Leiste bleibt beim Scrollen sichtbar.

Die Anfrage liegt in einer Karte mit Goldkante. Rang-Symbole und Stufen ersetzen Freitext, Helden sind als durchsuchbare Porträtauswahl verfügbar. Die Bilder und Heldenliste stammen aus dem bestehenden Website-Bestand. Rang und Stufen nutzen denselben Bestand wie die Scrim-Anmeldung.

Zeitwünsche erlauben mehrere Chips und eigene Zeitfenster mit TT.MM.JJJJ und HH:MM. Kalenderdatum, Vergangenheit, unvollständige Angaben und Reihenfolge der Uhrzeiten werden geprüft. Verbesserungsziele sind mehrfach auswählbar, Freitext ist optional. Der Senden-Button bleibt gold und anklickbar, fehlende Pflichtangaben werden inline angezeigt. Während einer laufenden Anfrage verhindert die Submit-Funktion doppelte Übermittlung. Erfolg erscheint ausschließlich nach erfolgreicher API-Antwort, Fehler erhalten die Eingaben.

Die bestehenden Pflichtangaben und der POST-Endpunkt bleiben erhalten. Mehrfachauswahlen werden in die bestehenden Textfelder geschrieben. Ein über den Profil-Link gewählter Coach wird weiterhin mitgeschickt. Games/Stunden bleiben wie bisher eine gemeinsame Eingabe und werden in beide bestehenden API-Felder übertragen.

ABWEICHUNG: Keine Vorbefüllung von Games oder Stunden. AuthContext/User, die Coaching-API und die vorhandene Steam-Verknüpfung im Website-Backend bieten keine Datenquelle für diese Werte. Die Steam-Rollenverknüpfung lädt lediglich Verknüpfungsstatus und Rang. Voice-Stunden in der Aktivitätsseite sind keine Deadlock-Spielstunden. Es wurde kein neuer Datenpfad angelegt.

Prüfung: TypeScript und Vite-Build, ESLint, 19 bestehende und ergänzte Tests. Der lokale Browsertest verwendet ausschließlich fiktive Benutzer und abgefangene API-Antworten. Er prüft Pflichtfelder, Suche, Chips, ungültige Daten, mehrere Zeitfenster, Fehler mit Erhalt der Eingaben und den Erfolgszustand samt gesendetem Payload. Es entstehen keine echten Coaching-Anfragen.

Sichtnachweise: `/home/nathanael/Documents/draft-screenshots/coaching-redesign-20261001`. Desktop und Mobil werden zusätzlich anhand von Viewport-Aufnahmen selbst geprüft. Die JSON-Auswertung erfasst Breiten, horizontalen Überlauf und Überlappungen der Leiste.

Deploy: Statisches Frontend, keine Backend-Änderung. Der laufende Backend-Release stammt aus `9c13f3b61d4f23bdddbe37ff0f771e4c2d8ee7c2`, der geprüfte Pfad ist `/opt/deadlock/website-backend/releases/9c13f3b61d4f23bdddbe37ff0f771e4c2d8ee7c2/ddc-website-backend`. Das Frontend wird aus dem gemergten Remote-Stand gebaut und unter dem bestehenden Caddy-Ziel veröffentlicht. Ein Backend- oder Caddy-Neustart ist dafür nicht erforderlich.

Abnahme vor dem Gate: Navigation für Gast, Nutzer, Coach und Admin auf 320, 390 und 1440 Pixeln durchgeklickt, einschließlich aller persönlichen Links und Abmelden. Das Formular wurde auf 320, 390, 640, 768, 980, 1024 und 1440 Pixeln funktional geprüft. Kein horizontaler Überlauf, keine Überschneidung der Header-Elemente, keine JavaScript-Seitenfehler. Desktop- und Mobil-Screenshots sowie die Viewport-Serie wurden selbst betrachtet. Rangname und Stufe werden getrennt als `rank` und `subrank` übermittelt; die bestehende Queue setzt beide zusammen.
