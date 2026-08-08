#!/usr/bin/env python3
"""Fügt das Cloudflare-Web-Analytics-Snippet idempotent vor </body> ein.

Aufruf: inject-cf-analytics.py <datei-oder-verzeichnis> ...
Verzeichnisse werden rekursiv nach *.html durchsucht.
"""
import re
import sys
from pathlib import Path

MARKER = "static.cloudflareinsights.com"
# Der Beacon-Token steht ohnehin in jeder ausgelieferten Seite. Er wird aus der
# Referenzseite gelesen, damit er nur an einer Stelle im Repo gepflegt wird.
REFERENZ = Path(__file__).resolve().parent.parent / "dl-landing/index.html"
TOKEN = re.search(r'"token":\s*"([0-9a-f]{32})"', REFERENZ.read_text(encoding="utf-8")).group(1)
SNIPPET = (
    "  <!-- Cloudflare Web Analytics -->"
    "<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' "
    f"data-cf-beacon='{{\"token\": \"{TOKEN}\"}}'></script>"
    "<!-- End Cloudflare Web Analytics -->\n"
)


def inject(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return "skip"
    idx = text.rfind("</body>")
    if idx == -1:
        return "no-body"
    line_start = text.rfind("\n", 0, idx) + 1
    path.write_text(text[:line_start] + SNIPPET + text[line_start:], encoding="utf-8")
    return "ok"


# Seiten, die bewusst ohne Beacon bleiben: Admin-Oberflaechen und der interne
# Statusreport. Bei einer Verzeichniseingabe werden sie uebersprungen, sonst
# zaehlen eigene Verwaltungsklicks als Besuche.
AUSGENOMMEN = ("/admin/", "/cutover-report/", "/.superpowers/", "/node_modules/")


def ausgenommen(p: Path) -> bool:
    return any(teil in p.as_posix() for teil in AUSGENOMMEN)


def main(argv: list[str]) -> int:
    targets: list[Path] = []
    for arg in argv:
        p = Path(arg)
        if p.is_dir():
            targets.extend(t for t in sorted(p.rglob("*.html")) if not ausgenommen(t))
        else:
            # Eine einzeln benannte Datei ist eine bewusste Entscheidung.
            targets.append(p)

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
