"""Erkennung des Cloudflare-Web-Analytics-Beacons in ausgelieferten Seiten.

Eine Quelle für beide Prüfungen: `test_cf_analytics.py` liest die Dateien im
Repo, `check_beacon_live.py` liest die echten HTTP-Antworten.
"""
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

BEACON_PFAD = "https://static.cloudflareinsights.com/beacon.min.js"
RUM_HOST = "https://cloudflareinsights.com"
BEACON_HOST = "https://static.cloudflareinsights.com"

# Ein Beacon-Tag, unabhängig von Token und Attributfolge. `(?<![-\w])src`
# schliesst `data-src` und Konsorten aus; der Pfad wird case-sensitiv geprüft,
# weil URL-Pfade es sind.
BEACON_TAG = re.compile(
    r"<script\b[^>]*(?<![-\w])src\s*=\s*[\"']"
    r"(?-i:https://static\.cloudflareinsights\.com/beacon\.min\.js)"
    r"(?:\?[^\"']*)?[\"'][^>]*>",
    re.IGNORECASE,
)
KOMMENTAR = re.compile(r"<!--.*?-->", re.DOTALL)

# Nur das echte Attribut, nicht `x-data-cf-beacon` oder `foo-data-cf-beacon`.
CF_ATTRIBUT = re.compile(
    r"(?<![-\w])data-cf-beacon\s*=\s*(['\"])(?P<wert>.*?)\1",
    re.IGNORECASE | re.DOTALL,
)


def token_aus_referenz() -> str:
    """Der Token steht per Design in jeder ausgelieferten Seite; die Startseite
    ist die Referenz, gegen die alle anderen geprüft werden."""
    quelle = (REPO / "dl-landing/index.html").read_text(encoding="utf-8")
    treffer = re.search(r'"token":\s*"([0-9a-f]{32})"', quelle)
    if not treffer:
        raise RuntimeError("kein Token in dl-landing/index.html gefunden")
    return treffer.group(1)


def aktive_beacons(text: str) -> list[str]:
    """Beacon-Tags ausserhalb von HTML-Kommentaren — ein auskommentierter Tag
    lädt nichts und zählt deshalb nicht."""
    ohne_kommentare = KOMMENTAR.sub(lambda m: " " * len(m.group(0)), text)
    return BEACON_TAG.findall(ohne_kommentare)


def beacon_aktiv(text: str, token: str) -> bool:
    """Genau ein aktiver Beacon, und zwar mit dem erwarteten Token. Der Token
    zählt nur in der Konfiguration, nicht irgendwo im Tag."""
    treffer = aktive_beacons(text)
    if len(treffer) != 1:
        return False
    tag = treffer[0]
    attribut = CF_ATTRIBUT.search(tag)
    if attribut:
        # Cloudflare liest den Wert als JSON; kaputtes JSON konfiguriert nichts.
        try:
            konfiguration = json.loads(attribut.group("wert"))
        except (ValueError, TypeError):
            return False
        return isinstance(konfiguration, dict) and konfiguration.get("token") == token
    # Zweite offizielle Form: Token als Query-Parameter am src.
    return bool(re.search(r"[?&]token=" + re.escape(token) + r"(?![\w-])", tag))
