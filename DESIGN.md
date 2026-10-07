# Öffentliche Deadlock-Welt

## Entscheidung
Die beauftragte Richtung ersetzt den bisherigen Kartenlook. Maßgeblich sind die vollständig gerenderten Valve-Seiten https://www.playdeadlock.com/oldgods und https://www.playdeadlock.com/cityneversleeps: große raue Plakatschrift, schräge Collagen, Körnung, überlappende Bildrahmen und deutlich wechselnde farbige Bühnen. Unsere kürzere Community-Reise übernimmt deren Materialgefühl und Kompositionswechsel.

## Material und Typografie
Die vier vom Nutzer bereitgestellten Motive liegen lokal als responsive AVIF/WebP-Varianten vor. Skranji Bold prägt die Plakattitel, Barlow Condensed Bold ist die ergänzende schmale Displayschrift. Bestehende Sora dient dem Lesetext. Beide neuen Fonts haben lokal abgelegte OFL-Lizenzen. Valve-Fonts werden nicht weiterverteilt. Eigene SVG-Körnung und gedruckte Kanten ergänzen die Spielbilder.

## Komposition
Die Startseite beginnt mit nächtlicher Stadt, Figur rechts, gedrehter Community-H1 und orangefarbener Einladung. Eine überlappende Heldenportrait-Reihe führt in die Papierfläche. Danach folgen eine blaue Nachtclub-Collage für Mitspieler und eine kräftig gelbe Industriegassen-Bühne für Coaching mit dunklem Textplakat. Ein ruhiger Linkabschnitt und die blaue Geisterpassage schließen die Reise ab. Die Unterseiten verwenden jeweils ein eigenes Motiv und behalten ihre bestehenden Funktionen.

Mobil stehen die Hauptmotive oberhalb des Texts. Die Menülasche sitzt horizontal unten rechts und bleibt von der Überschrift getrennt. Die Deadlock-Zeile wird verkleinert, damit die vollständigen Buchstaben sichtbar sind. Bilddateien sind in 960 und 1920 Pixeln Breite vorhanden; mobile Ausschnitte entstehen über die Bildposition im Layout, nicht durch zusätzliche Crop-Dateien.

## Gemeinsame Bausteine
`dl-brand/world.css` ist auf `.deadlock-world` begrenzt. Header, Navigation, Fokus, Bildkapitel, Links und Footer verwenden die vorhandene Marke. Andere öffentliche Seiten und persönliche Coaching-Bereiche behalten ihr Layout. Die öffentliche Coaching-Übersicht hat denselben Hero im Buildzeit-HTML und in React.

## Bedienung
Der Hauptinhalt und die direkten Discord-Wege bleiben ohne JavaScript sichtbar. Coachliste, Live-Anzeige und Patchfilter benötigen JavaScript und haben entsprechende Hinweise oder Statusmeldungen. Tastaturfokus, reduzierte Bewegung und bestehende Elevator-Navigation bleiben erhalten. Die Prüfung umfasst eine gebündelte Desktop-/Mobilrunde, eine Sammelfixrunde und eine abschließende Bestätigung.
