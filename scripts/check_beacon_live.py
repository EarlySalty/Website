#!/usr/bin/env python3
"""Prüft an der echten HTTP-Antwort, ob Cloudflare Web Analytics laufen kann.

Zwei Bedingungen je Route: die Seite liefert genau einen aktiven Beacon mit
dem richtigen Token, und die Content-Security-Policy lässt Skript und
RUM-Upload durch.

Aufruf: python3 scripts/check_beacon_live.py [basis-url]

Ergänzt `test_cf_analytics.py`: dort wird geprüft, was im Repo liegt, hier,
was der Server tatsächlich ausliefert — inklusive der CSP, die im Caddy-Repo
steht.
"""
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beacon import (  # noqa: E402
    BEACON_HOST,
    REPO,
    RUM_HOST,
    beacon_aktiv,
    token_aus_referenz,
)

STANDARD_BASIS = "https://deutsche-deadlock-community.de"

# Öffentliche Routen mit Beacon. Bewusst draussen: /builds/admin, /report,
# /twitch/overlay, /twitch/pause-loop und die Demo-Dashboards.
ROUTEN = [
    "/",
    "/beitreten",
    "/mitspieler",
    "/helden",
    "/transparenz",
    "/guides/anfaenger",
    "/survey",
    "/patch",
    "/builds",
    "/builds/history",
    "/videos",
    "/aktivitaet",
    "/coaching",
    "/turnier",
    "/streamer",
    "/twitch/faq",
    "/twitch/onboarding",
    "/dokus",
    "/new/",
    "/new/audit/",
]

# Die Heldenseiten sind statische Dateien; ihre Liste steht im Repo, damit eine
# neu hinzugekommene Seite nicht stillschweigend ungeprüft bleibt.
ROUTEN += sorted(
    f"/patch/hero/{p.name}" for p in (REPO / "dl-patch/public/hero").glob("*.html")
)


def csp_quellen(header_werte, kette):
    """Die wirksame Quellenliste für eine Direktive, nach den Fallback-Regeln
    (`script-src-elem` vor `script-src` vor `default-src`). Rückgabe je Policy:
    None heisst "diese Policy schränkt nicht ein"."""
    ergebnis = []
    for wert in header_werte:
        direktiven = {}
        for teil in wert.split(";"):
            felder = teil.split()
            # Wiederholte Direktiven ignoriert der Browser; die erste gilt.
            if felder and felder[0].lower() not in direktiven:
                direktiven[felder[0].lower()] = [f.lower() for f in felder[1:]]
        for name in kette:
            if name in direktiven:
                ergebnis.append(direktiven[name])
                break
        else:
            ergebnis.append(None)
    return ergebnis


def _quelle_passt(quelle, host_ohne_schema):
    if quelle in ("*", "https:", host_ohne_schema):
        return True
    if quelle.startswith("https://"):
        return quelle[len("https://"):].rstrip("/") == host_ohne_schema
    # `*.beispiel.de` deckt Unterdomains ab, nicht den nackten Host selbst.
    if quelle.startswith("*."):
        return host_ohne_schema.endswith("." + quelle[2:])
    return False


def erlaubt(header_werte, kette, host):
    """Jede gesetzte Policy muss den Host zulassen — mehrere CSP-Header wirken
    kumulativ, die strengste gewinnt."""
    host_ohne_schema = host.split("//", 1)[-1]
    for quellen in csp_quellen(header_werte, kette):
        if quellen is None:
            continue
        # `'strict-dynamic'` setzt Host-Quellen ausser Kraft: ein vom Parser
        # eingefügtes Tag lädt dann nur mit Nonce oder Hash. Das kann dieser
        # Check nicht beurteilen, also gilt es als nicht durchgelassen.
        if "'strict-dynamic'" in quellen:
            return False
        echte_quellen = [q for q in quellen if q != "'none'"]
        if not echte_quellen:
            return False
        if not any(_quelle_passt(q, host_ohne_schema) for q in echte_quellen):
            return False
    return True


def pruefe(basis, route, token):
    """(ok, meldung) für eine Route."""
    try:
        with urllib.request.urlopen(basis + route, timeout=20) as antwort:
            koerper = antwort.read().decode("utf-8", "replace")
            csp = antwort.headers.get_all("content-security-policy") or []
            status = antwort.status
    except urllib.error.HTTPError as fehler:
        return False, f"HTTP {fehler.code}"
    except (urllib.error.URLError, OSError, TimeoutError) as fehler:
        return False, f"keine Antwort ({fehler})"

    if status != 200:
        return False, f"HTTP {status}"
    if not beacon_aktiv(koerper, token):
        return False, "kein aktiver Beacon mit dem erwarteten Token"
    if not erlaubt(csp, ["script-src-elem", "script-src", "default-src"], BEACON_HOST):
        return False, "CSP lässt das Beacon-Skript nicht zu"
    if not erlaubt(csp, ["connect-src", "default-src"], RUM_HOST):
        return False, "CSP lässt den RUM-Upload nicht zu"
    return True, "Beacon ausgeliefert, CSP durchlässig"


def main():
    basis = (sys.argv[1] if len(sys.argv) > 1 else STANDARD_BASIS).rstrip("/")
    token = token_aus_referenz()
    fehler = 0
    for route in ROUTEN:
        ok, meldung = pruefe(basis, route, token)
        if not ok:
            fehler = 1
        print(f"{'OK    ' if ok else 'FEHLER'} {route:<28} {meldung}")
    return fehler


if __name__ == "__main__":
    sys.exit(main())
