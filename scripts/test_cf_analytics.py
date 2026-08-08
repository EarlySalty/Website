"""Prüft, dass Cloudflare Web Analytics auf allen ausgelieferten Seiten aktiv
ist.

Lauf: python3 -m pytest scripts/test_cf_analytics.py -v

Geprüft wird der Endzustand der Seiten, nicht der Weg dorthin: genau ein
aktiver Beacon-Tag je Seite, mit dem Token aus der Referenzseite.

Die Prüfung der gebauten Artefakte setzt einen vorherigen Build voraus
(`npm run build` je Anwendung); nur ein komplett ungebauter Checkout wird
übersprungen.

Nicht hier: ob die CSP den Beacon durchlässt. Das steht im Caddy-Repo und wird
an der echten HTTP-Antwort geprüft — `scripts/check_beacon_live.py`.

Deckung: nur Seiten aus diesem Repo. `/streamer`, `/twitch/onboarding` und
`/twitch/faq` werden aus `Deadlock-Twitch-Bot/website` ausgeliefert, `/turnier`
aus `Deadlock-Turniere/frontend`; diese Routen prüft allein der Live-Check,
hier kann darüber nichts stehen. `dl-landing/streamer/index.html` ist nicht
die Live-Route.

Bewusst ohne Beacon: Admin-Oberflächen (`/builds/admin`), der interne
Statusreport `cutover-report/` (`/report`), Overlay, Pause-Loop, die
Demo-Dashboards und `/dokus` (dessen Korpus-Vertrag verbietet Skripte und
externe Assets).
"""
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beacon import REPO, aktive_beacons, token_aus_referenz  # noqa: E402
from beacon import beacon_aktiv as _beacon_aktiv  # noqa: E402

TOKEN = token_aus_referenz()


def beacon_aktiv(text: str) -> bool:
    return _beacon_aktiv(text, TOKEN)


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
        # Ein anders benanntes Attribut konfiguriert nichts.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " x-data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", False),
        # Cloudflare liest den Wert als JSON; kaputtes JSON konfiguriert nichts.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"'></script>", False),
        # Token als Praefix eines laengeren Query-Wertes zaehlt nicht.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js?token=TOKENxy'></script>", False),
        # Der Token muss im src stehen, nicht irgendwo sonst im Tag.
        ("<script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-note='?token=TOKEN'></script>", False),
        # Nicht ausfuehrbare Typen laden kein Skript.
        ("<script type='application/json'"
         " src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", False),
        # Innerhalb eines template-Elements passiert nichts.
        ("<template><script src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script></template>", False),
        # Unquotiertes src laedt der Browser genauso.
        ("<script src=https://static.cloudflareinsights.com/beacon.min.js"
         " data-cf-beacon='{\"token\": \"TOKEN\"}'></script>", True),
        # Beim doppelten src gilt das erste — hier der fremde Host.
        ("<script src='https://evil.example/x.js'"
         " src='https://static.cloudflareinsights.com/beacon.min.js'"
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
        # Unquotiertes src laedt der Browser genauso.
        ("<script src=https://static.cloudflareinsights.com/beacon.min.js></script>", False),
        ("<script src=https://evil.example/x.js></script>", True),
        ("<script src=https://evil.example/x.js"
         " src='https://static.cloudflareinsights.com/beacon.min.js'></script>", True),
        ("<script src=https://static.cloudflareinsights.com/beacon.min.js.evil/x.js></script>", True),
    ],
)
def test_sri_regel(tag, gemeldet):
    assert bool(_sri_regex().search(tag)) is gemeldet, tag


# --- CSP-Auswertung des Live-Checks ---------------------------------------

from check_beacon_live import erlaubt  # noqa: E402

SKRIPT = ["script-src-elem", "script-src", "default-src"]
VERBINDUNG = ["connect-src", "default-src"]
BEACON = "https://static.cloudflareinsights.com"
RUM = "https://cloudflareinsights.com"


@pytest.mark.parametrize(
    "header,kette,host,erwartet",
    [
        ([], SKRIPT, BEACON, True),
        (["script-src 'self' https://static.cloudflareinsights.com"], SKRIPT, BEACON, True),
        (["script-src 'self'"], SKRIPT, BEACON, False),
        # Ohne script-src greift default-src.
        (["default-src 'self'"], SKRIPT, BEACON, False),
        (["default-src 'self' https://static.cloudflareinsights.com"], SKRIPT, BEACON, True),
        # script-src-elem schlaegt script-src fuer Tags.
        (["script-src https://static.cloudflareinsights.com; script-src-elem 'self'"],
         SKRIPT, BEACON, False),
        # Zwei Policies wirken kumulativ, die strengste gewinnt.
        (["script-src https://static.cloudflareinsights.com", "script-src 'self'"],
         SKRIPT, BEACON, False),
        (["default-src *"], VERBINDUNG, RUM, True),
        (["connect-src 'none'"], VERBINDUNG, RUM, False),
        (["connect-src 'self' https://cloudflareinsights.com"], VERBINDUNG, RUM, True),
        # Der Beacon-Host ist nicht der RUM-Host.
        (["connect-src https://static.cloudflareinsights.com"], VERBINDUNG, RUM, False),
        # Eine Wildcard deckt Unterdomains ab, nicht den nackten Host.
        (["connect-src *.cloudflareinsights.com"], VERBINDUNG, RUM, False),
        (["script-src *.cloudflareinsights.com"], SKRIPT, BEACON, True),
        # Wiederholte Direktiven ignoriert der Browser; die erste gilt.
        (["script-src 'self'; script-src https://static.cloudflareinsights.com"],
         SKRIPT, BEACON, False),
        # 'none' neben echten Quellen ist wirkungslos.
        (["script-src 'none' https://static.cloudflareinsights.com"], SKRIPT, BEACON, True),
        # strict-dynamic setzt Host-Quellen ausser Kraft.
        (["script-src 'strict-dynamic' https://static.cloudflareinsights.com"],
         SKRIPT, BEACON, False),
    ],
)
def test_csp_auswertung(header, kette, host, erwartet):
    assert erlaubt(header, kette, host) is erwartet
