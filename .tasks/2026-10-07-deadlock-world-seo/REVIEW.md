# Zentraler Merge-Gate

Der lokale `gate_hook.py --review` ist der einzige Reviewer. Es wurden keine zusätzlichen Review-Threads gestartet.

## Runde 1

Noch nicht ausgeführt. Der vollständige Implementierungsstand wird zuerst mit den Prüfbelegen committed und anschließend gegen den aktuellen Remote-main geprüft.

## Eigene Funktions- und Sichtprüfung

Die erste gebündelte Desktop-/Mobilprüfung zeigte abgeschnittene mobile Plakatschrift, eine überdeckende Menülasche, einen durch Alt-CSS verdeckten Mitspieler-Hero, unsichtbaren Coaching-Inhalt und eine zu breite Patch-Timeline. Diese Befunde wurden gemeinsam behoben. Die abschließende Bestätigung umfasst 20 Kombinationen aus fünf Routen, zwei Breiten und JavaScript an/aus: kein Dokument-Overflow, jeweils eine H1, keine Anwendungsausnahmen, keine Console-Fehler und keine fehlgeschlagenen geprüften Bilder. Tastaturmenü 10/10, Turmetagenwechsel 2/2, Patchfilter 2/2. Die Coach-Anfrage entfernt den öffentlichen Gestaltungsscope und setzt noindex. Nachbarseiten bleiben außerhalb des Scopes.

Belege: `/tmp/deadlock-world-confirm-20261007/results.json`, `desktop-overview.png`, `mobile-overview.png`, weitere Viewportaufnahmen im selben Verzeichnis. Der Prüfbrowser verwendet echte öffentliche API-Antworten. Analytics und Google-Aufrufe werden im Prüfbrowser unterdrückt; deren Verhalten wird dadurch nicht geprüft.
