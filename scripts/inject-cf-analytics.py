#!/usr/bin/env python3
"""Fügt das Cloudflare-Web-Analytics-Snippet idempotent vor </body> ein.

Aufruf: inject-cf-analytics.py <datei-oder-verzeichnis> ...
Verzeichnisse werden rekursiv nach *.html durchsucht; Admin-Oberflächen, der
interne Statusreport, Brainstorm-Fragmente und node_modules bleiben aussen vor.

Exit 0 nur, wenn jede erreichte Seite danach genau einen aktiven Beacon hat.
Exit 1 bei ausgelassenen Seiten oder leerer Zielmenge, Exit 2 ohne Argument.
"""
import re
import sys
from pathlib import Path

# Der Beacon-Token steht ohnehin in jeder ausgelieferten Seite. Er wird aus der
# Referenzseite gelesen, damit er nur an einer Stelle im Repo gepflegt wird.
REFERENZ = Path(__file__).resolve().parent.parent / "dl-landing/index.html"
TOKEN = re.search(r'"token":\s*"([0-9a-f]{32})"', REFERENZ.read_text(encoding="utf-8")).group(1)
SNIPPET = (
    "<!-- Cloudflare Web Analytics -->"
    "<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' "
    f"data-cf-beacon='{{\"token\": \"{TOKEN}\"}}'></script>"
    "<!-- End Cloudflare Web Analytics -->"
)

# Irgendein Beacon-Script-Tag, unabhaengig vom Token und von der Attributfolge.
BEACON_IRGENDEIN = re.compile(
    r"<script\b[^>]*(?<![-\w])src\s*=\s*[\"']https://static\.cloudflareinsights\.com/"
    r"beacon\.min\.js[\"'][^>]*>(?:</script>)?",
    re.IGNORECASE,
)
KOMMENTAR = re.compile(r"<!--.*?-->", re.DOTALL)

# Seiten, die bewusst ohne Beacon bleiben, plus Verzeichnisse ohne Live-Bezug.
AUSGENOMMEN = ("/admin/", "/cutover-report/", "/.superpowers/", "/node_modules/", "/dist/")


def ausgenommen(p: Path) -> bool:
    """Vergleicht am aufgelösten Pfad, sonst greift der Ausschluss bei
    relativen Angaben wie ``cutover-report/index.html`` nicht."""
    pfad = p.resolve().as_posix()
    return any(teil in pfad for teil in AUSGENOMMEN)


def aktive_beacons(text: str) -> list[str]:
    """Beacon-Tags ausserhalb von HTML-Kommentaren. Ein auskommentierter Tag
    laedt nichts und darf deshalb nicht als vorhanden zaehlen."""
    ohne_kommentare = KOMMENTAR.sub(lambda m: " " * len(m.group(0)), text)
    return BEACON_IRGENDEIN.findall(ohne_kommentare)


def hat_aktuellen_beacon(text: str) -> bool:
    treffer = aktive_beacons(text)
    return len(treffer) == 1 and f'"{TOKEN}"' in treffer[0]


def inject(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if hat_aktuellen_beacon(text):
        return "skip"

    # Veraltete oder doppelte Beacons (anderer Token, andere Attributfolge)
    # werden ersetzt statt ergaenzt, sonst laeuft das Skript doppelt.
    ohne_kommentare = KOMMENTAR.sub(lambda m: " " * len(m.group(0)), text)
    if BEACON_IRGENDEIN.search(ohne_kommentare):
        neu, _ = _ersetze_ausserhalb_kommentaren(text)
        path.write_text(neu, encoding="utf-8")
        return "ok"

    idx = text.rfind("</body>")
    if idx == -1:
        return "no-body"
    # Nur wenn vor </body> in derselben Zeile ausschliesslich Leerraum steht,
    # darf das Snippet eine eigene Zeile bekommen — sonst landet es bei
    # einzeiligem HTML vor dem Doctype.
    zeilenanfang = text.rfind("\n", 0, idx) + 1
    if text[zeilenanfang:idx].strip() == "":
        einschub = "  " + SNIPPET + "\n"
        return _schreibe(path, text[:zeilenanfang] + einschub + text[zeilenanfang:])
    return _schreibe(path, text[:idx] + SNIPPET + text[idx:])


def _ersetze_ausserhalb_kommentaren(text: str) -> tuple[str, int]:
    """Ersetzt den ersten aktiven Beacon-Tag durch das aktuelle Snippet und
    entfernt weitere aktive Beacons."""
    kommentarbereiche = [(m.start(), m.end()) for m in KOMMENTAR.finditer(text)]

    def im_kommentar(pos: int) -> bool:
        return any(a <= pos < b for a, b in kommentarbereiche)

    ergebnis, letzte, anzahl = [], 0, 0
    for m in BEACON_IRGENDEIN.finditer(text):
        if im_kommentar(m.start()):
            continue
        ergebnis.append(text[letzte : m.start()])
        if anzahl == 0:
            ergebnis.append(SNIPPET)
        anzahl += 1
        letzte = m.end()
    ergebnis.append(text[letzte:])
    return "".join(ergebnis), anzahl


def _schreibe(path: Path, inhalt: str) -> str:
    path.write_text(inhalt, encoding="utf-8")
    return "ok"


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2

    targets: list[Path] = []
    for arg in argv:
        p = Path(arg)
        if p.is_dir():
            targets.extend(t for t in sorted(p.rglob("*.html")) if not ausgenommen(t))
        else:
            # Eine einzeln benannte Datei ist eine bewusste Entscheidung.
            targets.append(p)

    if not targets:
        print("keine Zielseite gefunden", file=sys.stderr)
        return 1

    counts = {"ok": 0, "skip": 0, "no-body": 0}
    for t in targets:
        result = inject(t)
        counts[result] += 1
        if result != "skip":
            print(f"{result}: {t}")
    print(f"\neingefügt={counts['ok']} bereits={counts['skip']} ohne-body={counts['no-body']}")
    # Ausgelassene Seiten sind ein Fehlschlag, sonst wertet eine Automatisierung
    # sie als erledigt.
    return 1 if counts["no-body"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
