"""Prüft, dass Cloudflare Web Analytics auf allen ausgelieferten Seiten aktiv
ist und die Caddy-CSP den Beacon nicht blockt.

Lauf: python3 -m pytest scripts/test_cf_analytics.py -v

Geprüft wird der Endzustand der Seiten, nicht der Weg dorthin: genau ein
aktiver Beacon-Tag je Seite, mit dem Token aus der Referenzseite.

Die Prüfung der gebauten Artefakte setzt einen vorherigen Build voraus
(`npm run build` je Anwendung); nur ein komplett ungebauter Checkout wird
übersprungen. Die CSP-Prüfung liest das Caddy-Repo, Pfad überschreibbar per
Umgebungsvariable `CADDYFILE`.

Deckung: nur Seiten aus diesem Repo. `/streamer`, `/twitch/onboarding` und
`/twitch/faq` kommen aus `Deadlock-Twitch-Bot/website`, `/turnier` aus
`Deadlock-Turniere/frontend`, `/dokus` aus `Deadlock-Docs/public` — dort steht
der Beacon in der eigenen Quelle. `dl-landing/streamer/index.html` ist nicht
die Live-Route.

Bewusst ohne Beacon: Admin-Oberflächen (`/builds/admin`), der interne
Statusreport `cutover-report/` (`/report`), Overlay, Pause-Loop und die
Demo-Dashboards.
"""
import os
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
CADDYFILE = Path(os.environ.get("CADDYFILE", "/home/naniadm/Documents/Caddy/conf/Caddyfile"))

BEACON_HOST = "https://static.cloudflareinsights.com"
RUM_HOST = "https://cloudflareinsights.com"

# Referenzseite: der Token steht in jeder ausgelieferten Seite, hier wird
# geprüft, dass überall derselbe steht.
TOKEN = re.search(
    r'"token":\s*"([0-9a-f]{32})"',
    (REPO / "dl-landing/index.html").read_text(encoding="utf-8"),
).group(1)

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


def aktive_beacons(text: str) -> list[str]:
    """Beacon-Tags ausserhalb von HTML-Kommentaren — ein auskommentierter Tag
    lädt nichts und zählt deshalb nicht."""
    ohne_kommentare = KOMMENTAR.sub(lambda m: " " * len(m.group(0)), text)
    return BEACON_TAG.findall(ohne_kommentare)


def beacon_aktiv(text: str) -> bool:
    """Genau ein aktiver Beacon, und zwar mit dem aktuellen Token. Der Token
    zählt nur im dafür vorgesehenen Attribut, nicht irgendwo im Tag."""
    treffer = aktive_beacons(text)
    if len(treffer) != 1:
        return False
    tag = treffer[0]
    im_attribut = re.search(
        r"data-cf-beacon\s*=\s*(['\"])(?P<wert>.*?)\1", tag, re.IGNORECASE | re.DOTALL
    )
    if im_attribut:
        return bool(re.search(r'"token"\s*:\s*"' + TOKEN + r'"', im_attribut.group("wert")))
    # Cloudflare erlaubt den Token auch als Query-Parameter am src.
    return bool(re.search(r"[?&]token=" + TOKEN + r"\b", tag))


# --- ausgelieferte Seiten -------------------------------------------------

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

DIST_GLOBS = [
    "dl-landing/dist/**/*.html",
    "dl-patch/dist/**/*.html",
    "dl-tierlist/dist/**/*.html",
    "dl-activity/dist/**/*.html",
    "dl-coaching/dist/**/*.html",
]

OHNE_BEACON = ["cutover-report/index.html", "dl-tierlist/admin/index.html"]


@pytest.mark.parametrize("rel", QUELLEN)
def test_quelle_hat_snippet(rel):
    pfad = REPO / rel
    assert pfad.exists(), f"{rel} fehlt"
    assert beacon_aktiv(pfad.read_text(encoding="utf-8")), f"{rel} ohne aktiven Beacon"


@pytest.mark.parametrize("muster", DIST_GLOBS)
def test_build_artefakte_haben_snippet(muster):
    treffer = [p for p in REPO.glob(muster) if "/admin/" not in p.as_posix()]
    if not treffer:
        andere = [g for g in DIST_GLOBS if g != muster and any(REPO.glob(g))]
        if andere:
            pytest.fail(f"{muster} fehlt, andere dist-Verzeichnisse existieren — Build unvollstaendig")
        pytest.skip(f"kein Build-Artefakt fuer {muster} — erst npm run build")
    fehlend = [
        str(p.relative_to(REPO))
        for p in treffer
        if not beacon_aktiv(p.read_text(encoding="utf-8"))
    ]
    assert not fehlend, f"Beacon fehlt in: {fehlend}"


def test_hero_seiten_haben_snippet():
    heroes = list((REPO / "dl-patch/public/hero").glob("*.html"))
    assert len(heroes) >= 30, f"nur {len(heroes)} Heldenseiten gefunden"
    fehlend = [p.name for p in heroes if not beacon_aktiv(p.read_text(encoding="utf-8"))]
    assert not fehlend, f"Beacon fehlt in: {fehlend}"


@pytest.mark.parametrize("rel", OHNE_BEACON)
def test_ausgenommene_seite_hat_gar_keinen_beacon(rel):
    pfad = REPO / rel
    if not pfad.exists():
        pytest.skip(f"{rel} existiert nicht")
    assert not aktive_beacons(pfad.read_text(encoding="utf-8")), f"{rel} traegt einen Beacon"


# --- Erkennung selbst -----------------------------------------------------

@pytest.mark.parametrize(
    "seite,erwartet",
    [
        ("<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", True),
        # Token als Query-Parameter ist die zweite offizielle Form.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js?token=TOKEN'></script>", True),
        ("<!-- <script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script> -->", False),
        # Fremder Token.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"00000000000000000000000000000000\"}'></script>", False),
        # Token nur irgendwo im Tag, nicht im Konfigurationsattribut.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-note='TOKEN'></script>", False),
        # Zwei Beacons laufen doppelt.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>"
         "<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", False),
        # data-src laedt nichts.
        ("<script data-src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", False),
        ("<html><body>nichts</body></html>", False),
    ],
)
def test_beacon_erkennung(seite, erwartet):
    assert beacon_aktiv(seite.replace("TOKEN", TOKEN)) is erwartet


# --- SRI-Regel ------------------------------------------------------------

def _sri_regex() -> re.Pattern:
    regel = (REPO / ".semgrep-sri.yml").read_text(encoding="utf-8")
    muster = next(z.strip() for z in regel.splitlines() if z.strip().startswith("(?i)<script"))
    return re.compile(muster)


@pytest.mark.parametrize(
    "tag,gemeldet",
    [
        ("<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"x\"}'></script>", False),
        ("<script src='https://cdn.example/x.js' integrity='sha384-abc' crossorigin='anonymous'></script>", False),
        ("<script src='https://evil.example/x.js'></script>", True),
        ("<script src='https://static.cloudflareinsights.com.evil.example/x.js'></script>", True),
        ("<script src='https://static.cloudflareinsights.com/other.js'></script>", True),
        ("<script src='http://static.cloudflareinsights.com/beacon.min.js'></script>", True),
        # URL-Pfade sind case-sensitiv, eine abweichende Schreibweise ist ein
        # anderer Pfad und darf die Ausnahme nicht ausloesen.
        ("<script src='https://static.cloudflareinsights.com/BEACON.MIN.JS'></script>", True),
        ("<script src='https://evil.example/x.js' data-note='static.cloudflareinsights.com'></script>", True),
        ("<script data-src='https://static.cloudflareinsights.com/beacon.min.js'"
         " src='https://evil.example/x.js'></script>", True),
        ("<script src='https://evil.example/x.js'"
         " src='https://static.cloudflareinsights.com/beacon.min.js'></script>", True),
    ],
)
def test_sri_regel(tag, gemeldet):
    assert bool(_sri_regex().search(tag)) is gemeldet, tag


# --- CSP ------------------------------------------------------------------

def _direktiven(csp_zeile: str) -> dict[str, list[str]]:
    roh = csp_zeile.split('"')[1] if '"' in csp_zeile else csp_zeile
    werte = {}
    for teil in roh.split(";"):
        teil = teil.strip()
        if not teil:
            continue
        name, *quellen = teil.split()
        werte[name.lower()] = quellen
    return werte


def _csp_der_route(matcher: str) -> dict[str, list[str]]:
    zeilen = CADDYFILE.read_text(encoding="utf-8").splitlines()
    start = next(i for i, z in enumerate(zeilen) if z.strip().startswith(matcher))
    # `@demo` definiert den Matcher und setzt die CSP erst im handle-Block.
    treffer = [z for z in zeilen[start : start + 20] if "Content-Security-Policy" in z]
    assert treffer, f"kein CSP-Header zu {matcher} gefunden"
    return _direktiven(treffer[0])


def _erlaubt(quellen: list[str], host: str) -> bool:
    """Wildcards wie `https:` oder `*` erlauben den Host ebenfalls — sonst
    besteht eine viel zu weite CSP den Sperrtest."""
    return host in quellen or "https:" in quellen or "*" in quellen


CSP_MIT_BEACON = ["@non_demo_embed", "@coaching_paths", "@patch_paths", "@turnier_paths"]
CSP_OHNE_BEACON = ["@overlay_embed", "@pause_loop_page", "@demo_public", "@demo"]


@pytest.mark.parametrize("matcher", CSP_MIT_BEACON)
def test_csp_erlaubt_beacon(matcher):
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    csp = _csp_der_route(matcher)
    assert "script-src" in csp, f"{matcher}: keine script-src-Direktive"
    assert "connect-src" in csp, f"{matcher}: keine connect-src-Direktive"
    assert BEACON_HOST in csp["script-src"], f"{matcher}: script-src blockt den Beacon"
    assert RUM_HOST in csp["connect-src"], f"{matcher}: connect-src blockt den RUM-Upload"


@pytest.mark.parametrize("matcher", CSP_OHNE_BEACON)
def test_csp_ohne_beacon_bleibt_eng(matcher):
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    csp = _csp_der_route(matcher)
    quellen = csp.get("script-src", csp.get("default-src", []))
    assert not _erlaubt(quellen, BEACON_HOST), (
        f"{matcher} hat keinen Beacon, die CSP sollte ihn auch nicht erlauben"
    )


@pytest.mark.parametrize("wurzel", ["dl-activity/dist", "builds/frontend/dist-ddl"])
def test_route_mit_inline_csp_erlaubt_beacon(wurzel):
    """`/aktivitaet` und `/videos` tragen ihre CSP inline in der Route."""
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    inhalt = CADDYFILE.read_text(encoding="utf-8")
    stellen = [m.start() for m in re.finditer(re.escape(wurzel), inhalt)]
    assert stellen, f"{wurzel} kommt im Caddyfile nicht vor"

    # Ein Wurzelpfad steht mehrfach (Asset-Handler ohne CSP, HTML-Handler mit);
    # die CSP steht mal vor, mal hinter der Wurzelangabe.
    kandidaten = [
        _direktiven(z)
        for pos in stellen
        for z in inhalt[max(0, pos - 800) : pos + 800].splitlines()
        if "Content-Security-Policy" in z
    ]
    assert kandidaten, f"keine CSP in der Naehe von {wurzel}"
    passend = [
        c
        for c in kandidaten
        if BEACON_HOST in c.get("script-src", []) and RUM_HOST in c.get("connect-src", [])
    ]
    assert passend, f"CSP der Route zu {wurzel} blockt Beacon oder RUM-Upload"
