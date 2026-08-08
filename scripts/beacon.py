"""Erkennung des Cloudflare-Web-Analytics-Beacons in ausgelieferten Seiten.

Eine Quelle für beide Prüfungen: `test_cf_analytics.py` liest die Dateien im
Repo, `check_beacon_live.py` liest die echten HTTP-Antworten.

Gezählt wird nur, was der Browser auch ausführt: kein Kommentar, kein Inhalt
eines `<template>`, kein nicht-ausführbarer `type`, und der Token muss dort
stehen, wo Cloudflare ihn liest.
"""
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parent.parent

BEACON_URL = "https://static.cloudflareinsights.com/beacon.min.js"
BEACON_HOST = "https://static.cloudflareinsights.com"
RUM_HOST = "https://cloudflareinsights.com"

# Nur diese type-Werte führt der Browser als klassisches Skript aus; alles
# andere (application/json, text/template …) ist Datenablage.
AUSFUEHRBARE_TYPEN = {"", "module", "text/javascript", "application/javascript"}

SCRIPT_TAG = re.compile(r"<script\b[^>]*>", re.IGNORECASE)
ATTRIBUT = re.compile(
    r"""(?<![-\w])([-\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))""",
    re.IGNORECASE,
)
KOMMENTAR = re.compile(r"<!--.*?-->", re.DOTALL)
TEMPLATE = re.compile(r"<template\b[^>]*>.*?</template\s*>", re.DOTALL | re.IGNORECASE)


def token_aus_referenz() -> str:
    """Der Token steht per Design in jeder ausgelieferten Seite; die Startseite
    ist die Referenz, gegen die alle anderen geprüft werden."""
    quelle = (REPO / "dl-landing/index.html").read_text(encoding="utf-8")
    treffer = re.search(r'"token":\s*"([0-9a-f]{32})"', quelle)
    if not treffer:
        raise RuntimeError("kein Token in dl-landing/index.html gefunden")
    return treffer.group(1)


def _attribute(tag: str) -> dict:
    """Attribute eines Tags. Bei Wiederholung gewinnt das erste — so wie der
    Browser es liest, weshalb ein nachgeschobenes zweites `src` nichts
    heilt."""
    gefunden = {}
    for name, dq, sq, roh in ATTRIBUT.findall(tag):
        schluessel = name.lower()
        if schluessel not in gefunden:
            gefunden[schluessel] = dq or sq or roh
    return gefunden


def _ohne_inaktives(text: str) -> str:
    """Kommentare und Template-Inhalte ausmaskieren — dort lädt nichts."""
    maskiert = KOMMENTAR.sub(lambda m: " " * len(m.group(0)), text)
    return TEMPLATE.sub(lambda m: " " * len(m.group(0)), maskiert)


def aktive_beacons(text: str) -> list[str]:
    """Beacon-Tags, die der Browser tatsächlich lädt."""
    treffer = []
    for tag in SCRIPT_TAG.findall(_ohne_inaktives(text)):
        attribute = _attribute(tag)
        quelle = attribute.get("src")
        if not quelle:
            continue
        zerlegt = urlsplit(quelle)
        # Der Pfad wird case-sensitiv verglichen, URL-Pfade sind es.
        if f"{zerlegt.scheme}://{zerlegt.netloc}{zerlegt.path}" != BEACON_URL:
            continue
        if attribute.get("type", "").strip().lower() not in AUSFUEHRBARE_TYPEN:
            continue
        treffer.append(tag)
    return treffer


def beacon_aktiv(text: str, token: str) -> bool:
    """Genau ein aktiver Beacon, und zwar mit dem erwarteten Token. Der Token
    zählt nur dort, wo Cloudflare ihn liest: im JSON von `data-cf-beacon` oder
    als Query-Parameter am `src`."""
    treffer = aktive_beacons(text)
    if len(treffer) != 1:
        return False
    attribute = _attribute(treffer[0])
    if "data-cf-beacon" in attribute:
        # Cloudflare liest den Wert als JSON; kaputtes JSON konfiguriert nichts.
        try:
            konfiguration = json.loads(attribute["data-cf-beacon"])
        except (ValueError, TypeError):
            return False
        return isinstance(konfiguration, dict) and konfiguration.get("token") == token
    query = parse_qs(urlsplit(attribute["src"]).query)
    return query.get("token") == [token]
