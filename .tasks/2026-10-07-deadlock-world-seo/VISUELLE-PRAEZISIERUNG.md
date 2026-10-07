# Verbindliche Präzisierung des Nutzers

Der Nutzer hat nach dem Start ausdrücklich präzisiert:

> Schau dir bitte die 2 Websiten an wie die gemacht sind gestylet sind usw das finde ich geil
> DAS visuelle Text ist da eher egal

Die beiden Referenzseiten sind die visuelle Autorität. Nicht lediglich die Nutzerbilder in unser bisheriges Layout kleben. Die tatsächlich gerenderten Valve-Seiten ansehen: Größenverhältnisse, Bildschichtung und Freisteller, bewusst riesige Display-Schrift, Szenenwechsel, Textur, Farbflächen, Abschnittskanten und Scroll-Verhalten. Daraus unseren Aufbau ableiten. Text ist untergeordnet; SEO sauber mitnehmen, aber keine lange Text-/Marketingrunde auf Kosten der visuellen Umsetzung. Bestehende sachlich korrekte Texte können knapp bleiben.

## Gerenderte Referenzen jetzt erfolgreich geprüft

Die Hauptsession hat beide Seiten in einem isolierten Xvfb-Browser vollständig geladen und jeweils drei Scrollpositionen als Bild gelesen. Das funktioniert hier: `xvfb-run -a node /tmp/ddc-reference-20261007-54761527/reference-check.cjs`. Das Skript nutzt die bereits installierte `/tmp/earlysalty-browser/node_modules/playwright`, executablePath `/opt/brave.com/brave/brave`, headless false, frischen Browserkontext. T3 preview_open bleibt ohne Automation-Host und direktes Headless-Brave hängt; keine Zeit damit verlieren.

Lies diese sechs Bilder zwingend vor dem Design:
- `/tmp/ddc-reference-20261007-54761527/oldgods-top.png`
- `/tmp/ddc-reference-20261007-54761527/oldgods-middle.png`
- `/tmp/ddc-reference-20261007-54761527/oldgods-detail.png`
- `/tmp/ddc-reference-20261007-54761527/cityneversleeps-top.png`
- `/tmp/ddc-reference-20261007-54761527/cityneversleeps-middle.png`
- `/tmp/ddc-reference-20261007-54761527/cityneversleeps-detail.png`

Was tatsächlich die Wirkung trägt: Old Gods mit riesiger leicht gedrehter rauer Pulp-Schrift in Elfenbein vor ausgeschnittenen Patronen, kräftigem Orange/Blau und einer dichten Reihe schräger Heldenportraits. Nachfolgend schwarze Drucktexturen, unregelmäßige abgerissene Abschnittskanten, orange schräge Überschriftsschilder, überlappende Bildausschnitte. City Never Sleeps mit perspektivisch geschichteter Riesenüberschrift, Bildfüllung innerhalb der Buchstaben, rauer monochromer Skyline und einer Reihe farbiger Portraits. Darunter wie eine illustrierte Stadtführung: große Szenenbilder, absichtlich überlappende beige Bilderrahmen, asymmetrischer Bild/Text-Wechsel, tief getönte blaue/grüne/gelbe Kapitel mit Körnung. Kaum abgerundete Karten, kein SaaS-Baukasten, keine Schmuck-Goldrahmen um alles. Diese gestalterische Grammatik übernimmt unsere Website mit eigenen Überschriften und Community-Wegen.

Damit korrigiert sich eine mögliche Fehlinterpretation des ersten Briefings: Nicht bloß cineastisches Hintergrundbild mit generischer linksbündiger Serif-/Sans-Schrift. Die Plakat-/Collage-Komposition und markante typografische Identität sind ausdrücklich Teil des Auftrags. Ein unverändert generisches Layout mit neuen Bildern würde die Abnahme verfehlen. Der Nutzer erlaubt ausdrücklich auch Textinspiration, aber Styling und Deadlock-Gefühl haben Vorrang. Kein langes wörtliches Kopieren von Valve-Textblöcken nötig; eigene kurze deutsche Texte für unsere Community.

Keine vorhandene Desktop- oder Nutzer-Browsersitzung anfassen. Dieselbe funktionierende isolierte Browserstrecke für unsere Desktop-/Mobilprüfung verwenden.
