"""Prüft, dass das Cloudflare-Web-Analytics-Snippet auf allen ausgelieferten
Seiten steht und die Caddy-CSP den Beacon nicht blockt.

Lauf: python3 -m pytest scripts/test_cf_analytics.py -v

Die Prüfung der gebauten Artefakte setzt einen vorherigen Build voraus
(`npm run build` je Anwendung); fehlt ein `dist`, wird der Fall übersprungen
statt rot gemeldet. Gleiches gilt für die CSP-Prüfung, wenn das Caddy-Repo auf
dem Rechner nicht liegt.

Bewusst ohne Beacon und deshalb nicht in den Listen:
- Admin-Oberflächen (`/builds/admin`) — eigene Klicks wären sonst Besuche.
- `cutover-report/` (`/report` auf earlysalty.com) — interner Statusreport auf
  einer noindex-Domain, nicht Teil der Besucherzahlen.
"""
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
CADDYFILE = Path("/home/naniadm/Documents/Caddy/conf/Caddyfile")

# Referenz fuer den Beacon-Token: er steht in jeder ausgelieferten Seite, hier
# wird geprueft, dass ueberall derselbe steht.
TOKEN = re.search(
    r'"token":\s*"([0-9a-f]{32})"',
    (REPO / "dl-landing/index.html").read_text(encoding="utf-8"),
).group(1)
BEACON_HOST = "https://static.cloudflareinsights.com"
RUM_HOST = "https://cloudflareinsights.com"

# Quelldateien, aus denen Caddy (direkt oder ueber den Vite-Build) HTML ausliefert.
QUELLEN = [
    "deco-elevator-new/index.html",
    "deco-elevator-new/audit/index.html",
    "dl-landing/index.html",
    "dl-landing/mitspieler/index.html",
    "dl-landing/survey/index.html",
    "dl-landing/coaching/index.html",
    "dl-landing/streamer/index.html",
    "dl-landing/helden/index.html",
    "dl-landing/guides/anfaenger/index.html",
    "dl-landing/beitreten/index.html",
    "dl-landing/transparenz/index.html",
    "dl-patch/index.html",
    "dl-tierlist/index.html",
    "dl-tierlist/history/index.html",
    "dl-activity/index.html",
    "dl-coaching/index.html",
    "builds/frontend/index.html",
    # Live-Ziel der Video-Anwendung, wird nicht vom Standard-Build erzeugt.
    "builds/frontend/dist-ddl/index.html",
]

# Gebaute Artefakte, die Caddy direkt ausliefert.
DIST_GLOBS = [
    "dl-landing/dist/**/*.html",
    "dl-patch/dist/**/*.html",
    "dl-tierlist/dist/**/*.html",
    "dl-activity/dist/**/*.html",
    "dl-coaching/dist/**/*.html",
]

# CSP-Bloecke, die zu Routen mit eingebautem Snippet gehoeren.
CSP_ROUTEN = [
    "@non_demo_embed",
    "@coaching_paths",
    "@patch_paths",
    "@turnier_paths",
]


# Ein loser Substring-Treffer wuerde auch ein Kommentar erfuellen — geprueft
# wird der vollstaendige Script-Tag mit Beacon-src und passendem Token.
BEACON_TAG = re.compile(
    r"<script\b[^>]*\bsrc\s*=\s*[\"']https://static\.cloudflareinsights\.com/beacon\.min\.js[\"']"
    r"[^>]*\bdata-cf-beacon\s*=\s*'[^']*\"token\":\s*\"" + TOKEN + r"\"",
    re.IGNORECASE,
)


def snippet_vorhanden(text: str) -> bool:
    return BEACON_TAG.search(text) is not None


@pytest.mark.parametrize("rel", QUELLEN)
def test_quelle_hat_snippet(rel):
    pfad = REPO / rel
    assert pfad.exists(), f"{rel} fehlt"
    assert snippet_vorhanden(pfad.read_text(encoding="utf-8")), f"{rel} ohne Beacon"


@pytest.mark.parametrize("muster", DIST_GLOBS)
def test_build_artefakte_haben_snippet(muster):
    # Admin-Oberflaechen bleiben bewusst ohne Beacon, sonst zaehlen eigene
    # Verwaltungsklicks als Besuche.
    treffer = [p for p in REPO.glob(muster) if "/admin/" not in p.as_posix()]
    if not treffer:
        pytest.skip(f"kein Build-Artefakt fuer {muster} — erst npm run build")
    fehlend = [
        str(p.relative_to(REPO))
        for p in treffer
        if not snippet_vorhanden(p.read_text(encoding="utf-8"))
    ]
    assert not fehlend, f"Beacon fehlt in: {fehlend}"


def test_hero_seiten_haben_snippet():
    heroes = list((REPO / "dl-patch/public/hero").glob("*.html"))
    assert len(heroes) >= 30, f"nur {len(heroes)} Heldenseiten gefunden"
    fehlend = [p.name for p in heroes if not snippet_vorhanden(p.read_text(encoding="utf-8"))]
    assert not fehlend, f"Beacon fehlt in: {fehlend}"


def test_sri_ausnahme_gilt_nur_fuer_den_echten_beacon_host():
    """Die SRI-Regel darf nur den Cloudflare-Beacon durchlassen."""
    regel = (REPO / ".semgrep-sri.yml").read_text(encoding="utf-8")
    muster = next(
        z.strip()
        for z in regel.splitlines()
        if z.strip().startswith("(?i)<script")
    )
    rx = re.compile(muster)

    beacon = (
        "<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js'"
        " data-cf-beacon='{\"token\": \"x\"}'></script>"
    )
    fremd = "<script src='https://evil.example/x.js'></script>"
    getarnt = "<script src='https://static.cloudflareinsights.com.evil.example/x.js'></script>"
    attribut_trick = "<script src='https://evil.example/x.js' data-note='static.cloudflareinsights.com'></script>"
    data_src_trick = (
        "<script data-src='https://static.cloudflareinsights.com/beacon.min.js'"
        " src='https://evil.example/x.js'></script>"
    )
    doppeltes_src = (
        "<script src='https://evil.example/x.js'"
        " src='https://static.cloudflareinsights.com/beacon.min.js'></script>"
    )
    mit_sri = (
        "<script src='https://cdn.example/x.js' integrity='sha384-abc'"
        " crossorigin='anonymous'></script>"
    )

    assert not rx.search(beacon), "Beacon wird faelschlich als Verstoss gemeldet"
    assert not rx.search(mit_sri), "korrekt abgesichertes Skript wird gemeldet"
    assert rx.search(fremd), "fremdes Skript ohne SRI wird nicht gemeldet"
    assert rx.search(getarnt), "getarnter Host umgeht die SRI-Pflicht"
    assert rx.search(attribut_trick), "Attribut-Trick umgeht die SRI-Pflicht"
    assert rx.search(data_src_trick), "data-src umgeht die SRI-Pflicht"
    assert rx.search(doppeltes_src), "doppeltes src umgeht die SRI-Pflicht"


@pytest.mark.parametrize("matcher", CSP_ROUTEN)
def test_csp_erlaubt_beacon(matcher):
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    zeilen = CADDYFILE.read_text(encoding="utf-8").splitlines()
    start = next(i for i, z in enumerate(zeilen) if z.strip().startswith(matcher))
    csp = next(
        z for z in zeilen[start : start + 8] if "Content-Security-Policy" in z
    )
    script_teil = next(t for t in csp.split("; ") if t.lstrip().startswith("script-src"))
    connect_teil = next(t for t in csp.split("; ") if t.lstrip().startswith("connect-src"))
    assert BEACON_HOST in script_teil, f"{matcher}: script-src blockt den Beacon"
    assert RUM_HOST in connect_teil, f"{matcher}: connect-src blockt den RUM-Upload"
