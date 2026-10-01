# Übergabe an die Fix-Runde

Worktree: `/home/nathanael/.worktrees/Website-coaching-redesign`
Branch: `feat/coaching-redesign`
Implementierung: `0f4b40e95a0de93d76c921d3055e757a7a18b72d`
Stand: Runde 1 BLOCK, siehe `REVIEW.md`. Kein Merge und kein Deploy begonnen.

1. Mobile Datum-/Zeiteingabe reparieren, ohne deutsches Format zu verlieren. Zifferntastatur und automatische Trennzeichen beziehungsweise geeignetes Eingabeverhalten prüfen.
2. Beim Absenden gegen die aktuelle Zeit validieren und den Payload frisch zusammensetzen.
3. `npm run build`, `npm run lint`, `npm test` in `dl-coaching` ausführen. Das letzte Ergebnis war 19 von 19 Tests grün.
4. Formular und Menüs Desktop/mobil erneut selbst betrachten. Vorhandene Prüfskripte und Screenshots liegen unter `/home/nathanael/Documents/draft-screenshots/coaching-redesign-20261001`. Lokaler Vite-Testserver wurde beendet. Bei Bedarf im Worktree `npm run dev -- --host 127.0.0.1 --port 3109 --strictPort` starten. `form-check.mjs` und `navigation-check.mjs` verwenden fiktive Benutzer und abgefangene Antworten.
5. Fix committen, Feature-Branch pushen und zentralen Gate erneut starten. Reviewer aus Runde 1: `gpt-6.1-sol`, high. Gate-Kette nicht für ein anderes Urteil wechseln.
6. Nach ALLOW aus eigenem Integration-Worktree mergen und HEAD:main pushen. Der kanonische Checkout enthält fremde ungetrackte Arbeit, einschließlich der ursprünglichen Auftragsakte. Diese nicht verändern oder löschen.
7. Das Frontend aus dem gemergten Remote-Stand bauen und unter `/home/nathanael/repos/Website/dl-coaching/dist` veröffentlichen. Die Pfade `/home/naniadm/Documents/Website` und `/home/nathanael/Documents/Website` zeigen auf diesen Checkout. Vor dem Deploy dist sichern, alte gehashte Assets erhalten, index.html erst nach vollständigen Assets austauschen. Backend und Caddy wurden nicht geändert, dafür braucht es keinen Neustart. Der bestehende Backend-Release liegt unter `/opt/deadlock/website-backend/current`, Quelle `9c13f3b61d4f23bdddbe37ff0f771e4c2d8ee7c2`.
8. Live-Skript unter `/home/nathanael/Documents/draft-screenshots/coaching-redesign-20261001/live-check.mjs` vor Einsatz prüfen. Es vergleicht öffentliche JS/CSS-Hashes gegen einen per Argument übergebenen Build, prüft Helden- und Rangbilder und navigiert öffentliche Coach-Profile. Die Formularansicht läuft mit isolierter Test-Anmeldung; echte POST-Anfragen werden geblockt. Das Skript wurde vorbereitet, aber noch nicht live ausgeführt. Möglicherweise muss der vorhandene Überschrift-Selektor auf der Coaches-Seite angepasst werden.
9. Nach Live-Beweis Branch-/Worktree-Abstammung prüfen, Branch und Worktree entfernen. Screenshots und Reports außerhalb des Worktrees erhalten. Erst nach abgeschlossener Arbeit selbst settlen.

ABWEICHUNG: Games/Stunden bleiben manuell. Der Website-Code hat keine geeignete Spielstunden-/Games-Datenquelle; Steam liefert dort nur Rang und Verknüpfungsstatus. Die bestehende gemeinsame Eingabe wird weiterhin in beide API-Felder übertragen.
