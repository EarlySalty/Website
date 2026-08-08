"""Prüft, dass das Cloudflare-Web-Analytics-Snippet auf allen ausgelieferten
Seiten aktiv ist, die Caddy-CSP den Beacon nicht blockt und das Injektionsskript
sich korrekt verhält.

Lauf: python3 -m pytest scripts/test_cf_analytics.py -v

Die Prüfung der gebauten Artefakte setzt einen vorherigen Build voraus
(`npm run build` je Anwendung); nur ein komplett ungebauter Checkout wird
übersprungen. Die CSP-Prüfung liest das Caddy-Repo, Pfad überschreibbar per
`CADDYFILE`.

Deckung: geprüft werden nur die Seiten, die aus diesem Repo ausgeliefert
werden. `/streamer`, `/twitch/onboarding` und `/twitch/faq` kommen aus
`Deadlock-Twitch-Bot/website`, `/turnier` aus `Deadlock-Turniere/frontend`,
`/dokus` aus `Deadlock-Docs/public` — dort steht der Beacon in der eigenen
Quelle. `dl-landing/streamer/index.html` ist nicht die Live-Route.

Bewusst ohne Beacon:
- Admin-Oberflächen (`/builds/admin`) — eigene Klicks wären sonst Besuche.
- `cutover-report/` (`/report` auf earlysalty.com) — interner Statusreport auf
  einer noindex-Domain.
- Overlay, Pause-Loop und die Demo-Dashboards — kein Besucher-Traffic.
"""
import importlib.util
import os
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
CADDYFILE = Path(os.environ.get("CADDYFILE", "/home/naniadm/Documents/Caddy/conf/Caddyfile"))

_spec = importlib.util.spec_from_file_location(
    "inject_cf_analytics", REPO / "scripts/inject-cf-analytics.py"
)
injector = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(injector)

TOKEN = injector.TOKEN
BEACON_HOST = "https://static.cloudflareinsights.com"
RUM_HOST = "https://cloudflareinsights.com"

# Quelldateien, aus denen Caddy (direkt oder über den Vite-Build) HTML ausliefert.
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

# CSP-Blöcke der Routen, auf denen ein Beacon läuft.
CSP_MIT_BEACON = ["@non_demo_embed", "@coaching_paths", "@patch_paths", "@turnier_paths"]
# Routen ohne Besucher-Traffic; deren CSP darf den Beacon weiter blocken.
CSP_OHNE_BEACON = ["@overlay_embed", "@pause_loop_page", "@demo_public", "@demo"]


def beacon_aktiv(text: str) -> bool:
    """Genau ein Beacon-Tag mit aktuellem Token, ausserhalb von Kommentaren."""
    return injector.hat_aktuellen_beacon(text)


# --- ausgelieferte Seiten -------------------------------------------------

@pytest.mark.parametrize("rel", QUELLEN)
def test_quelle_hat_snippet(rel):
    pfad = REPO / rel
    assert pfad.exists(), f"{rel} fehlt"
    assert beacon_aktiv(pfad.read_text(encoding="utf-8")), f"{rel} ohne aktiven Beacon"


@pytest.mark.parametrize("muster", DIST_GLOBS)
def test_build_artefakte_haben_snippet(muster):
    # Admin-Oberflächen bleiben bewusst ohne Beacon.
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


def test_ausgenommene_seiten_haben_keinen_beacon():
    ausnahmen = ["cutover-report/index.html", "dl-tierlist/admin/index.html"]
    drin = [
        rel
        for rel in ausnahmen
        if (REPO / rel).exists() and beacon_aktiv((REPO / rel).read_text(encoding="utf-8"))
    ]
    assert not drin, f"bewusst ausgenommene Seite traegt einen Beacon: {drin}"


# --- SRI-Regel ------------------------------------------------------------

def _sri_regex() -> re.Pattern:
    regel = (REPO / ".semgrep-sri.yml").read_text(encoding="utf-8")
    muster = next(z.strip() for z in regel.splitlines() if z.strip().startswith("(?i)<script"))
    return re.compile(muster)


@pytest.mark.parametrize(
    "tag,gemeldet",
    [
        # Der echte Beacon ist die einzige Ausnahme.
        ("<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js'"
         " data-cf-beacon='{\"token\": \"x\"}'></script>", False),
        ("<script src='https://cdn.example/x.js' integrity='sha384-abc' crossorigin='anonymous'></script>", False),
        ("<script src='https://evil.example/x.js'></script>", True),
        # Getarnter Host, der nur wie der Beacon aussieht.
        ("<script src='https://static.cloudflareinsights.com.evil.example/x.js'></script>", True),
        # Anderer Pfad auf dem Beacon-Host.
        ("<script src='https://static.cloudflareinsights.com/other.js'></script>", True),
        # Unverschluesselt, auch auf dem Beacon-Host.
        ("<script src='http://static.cloudflareinsights.com/beacon.min.js'></script>", True),
        # Der Host steht nur in einem harmlosen Attribut.
        ("<script src='https://evil.example/x.js' data-note='static.cloudflareinsights.com'></script>", True),
        # data-src ist kein Ladepfad und darf die Pflicht nicht aufheben.
        ("<script data-src='https://static.cloudflareinsights.com/beacon.min.js'"
         " src='https://evil.example/x.js'></script>", True),
        # Bei doppeltem src zaehlt das erste — der Beacon dahinter rettet nichts.
        ("<script src='https://evil.example/x.js'"
         " src='https://static.cloudflareinsights.com/beacon.min.js'></script>", True),
    ],
)
def test_sri_regel(tag, gemeldet):
    assert bool(_sri_regex().search(tag)) is gemeldet, tag


# --- CSP ------------------------------------------------------------------

def _csp_zeile(matcher: str) -> str:
    zeilen = CADDYFILE.read_text(encoding="utf-8").splitlines()
    start = next(i for i, z in enumerate(zeilen) if z.strip().startswith(matcher))
    # `@demo` definiert den Matcher und setzt die CSP erst im zugehoerigen
    # handle-Block ein paar Zeilen weiter unten.
    treffer = [z for z in zeilen[start : start + 20] if "Content-Security-Policy" in z]
    assert treffer, f"kein CSP-Header zu {matcher} gefunden"
    return treffer[0]


@pytest.mark.parametrize("matcher", CSP_MIT_BEACON)
def test_csp_erlaubt_beacon(matcher):
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    csp = _csp_zeile(matcher)
    script_teil = next(t for t in csp.split("; ") if t.lstrip().startswith("script-src"))
    connect_teil = next(t for t in csp.split("; ") if t.lstrip().startswith("connect-src"))
    assert BEACON_HOST in script_teil, f"{matcher}: script-src blockt den Beacon"
    assert RUM_HOST in connect_teil, f"{matcher}: connect-src blockt den RUM-Upload"


@pytest.mark.parametrize("matcher", CSP_OHNE_BEACON)
def test_csp_ohne_beacon_bleibt_eng(matcher):
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    assert BEACON_HOST not in _csp_zeile(matcher), (
        f"{matcher} hat keinen Beacon, die CSP sollte ihn auch nicht erlauben"
    )


def test_seiten_mit_eigener_csp_erlauben_den_beacon():
    """`/aktivitaet` und `/videos` tragen ihre CSP inline in der Route."""
    if not CADDYFILE.exists():
        pytest.skip("Caddy-Repo liegt auf diesem Rechner nicht")
    inhalt = CADDYFILE.read_text(encoding="utf-8")
    for wurzel in ["dl-activity/dist", "builds/frontend/dist-ddl"]:
        # Ein Wurzelpfad steht mehrfach in der Datei (Asset-Handler ohne CSP,
        # HTML-Handler mit). Es genuegt, dass die davor stehende CSP eines
        # Vorkommens den Beacon erlaubt.
        stellen = [m.start() for m in re.finditer(re.escape(wurzel), inhalt)]
        assert stellen, f"{wurzel} kommt im Caddyfile nicht vor"
        # Die CSP steht mal vor (aktivitaet), mal hinter (videos) der
        # Wurzelangabe — deshalb ein Fenster um die Fundstelle.
        umgebungen = [inhalt[max(0, pos - 800) : pos + 800] for pos in stellen]
        assert any(
            BEACON_HOST in z
            for u in umgebungen
            for z in u.splitlines()
            if "Content-Security-Policy" in z
        ), f"CSP der Route zu {wurzel} blockt den Beacon"


# --- Verhalten des Injektionsskripts --------------------------------------

def test_injektor_faellt_nicht_auf_kommentar_herein(tmp_path):
    seite = tmp_path / "index.html"
    seite.write_text(
        "<html><body><!-- static.cloudflareinsights.com war mal geplant -->\n</body></html>",
        encoding="utf-8",
    )
    assert injector.inject(seite) == "ok"
    assert beacon_aktiv(seite.read_text(encoding="utf-8"))


def test_injektor_erkennt_auskommentierten_beacon_als_fehlend(tmp_path):
    seite = tmp_path / "index.html"
    seite.write_text(
        "<html><body>\n<!-- <script src='https://static.cloudflareinsights.com/beacon.min.js'"
        " data-cf-beacon='{\"token\": \"" + TOKEN + "\"}'></script> -->\n</body></html>",
        encoding="utf-8",
    )
    assert injector.inject(seite) == "ok"
    assert beacon_aktiv(seite.read_text(encoding="utf-8"))


def test_injektor_ersetzt_alten_token_statt_zu_verdoppeln(tmp_path):
    seite = tmp_path / "index.html"
    alt = "0" * 32
    seite.write_text(
        "<html><body>\n<script src='https://static.cloudflareinsights.com/beacon.min.js'"
        " data-cf-beacon='{\"token\": \"" + alt + "\"}'></script>\n</body></html>",
        encoding="utf-8",
    )
    assert injector.inject(seite) == "ok"
    inhalt = seite.read_text(encoding="utf-8")
    assert inhalt.count("beacon.min.js") == 1, "zweiter Beacon eingefuegt"
    assert alt not in inhalt, "alter Token blieb stehen"
    assert beacon_aktiv(inhalt)


def test_injektor_haelt_einzeiliges_html_valide(tmp_path):
    seite = tmp_path / "index.html"
    seite.write_text("<!doctype html><html><body>Text</body></html>", encoding="utf-8")
    assert injector.inject(seite) == "ok"
    inhalt = seite.read_text(encoding="utf-8")
    assert inhalt.startswith("<!doctype html>"), "Snippet landete vor dem Doctype"
    assert inhalt.index("beacon.min.js") < inhalt.index("</body>")


def test_injektor_ist_idempotent(tmp_path):
    seite = tmp_path / "index.html"
    seite.write_text("<html><body>\n</body></html>", encoding="utf-8")
    assert injector.inject(seite) == "ok"
    assert injector.inject(seite) == "skip"
    assert seite.read_text(encoding="utf-8").count("beacon.min.js") == 1


def test_injektor_ohne_ziel_meldet_fehler():
    assert injector.main([]) == 2


def test_injektor_meldet_leere_zielmenge(tmp_path):
    leer = tmp_path / "leer"
    leer.mkdir()
    assert injector.main([str(leer)]) == 1


def test_injektor_ueberspringt_ausgenommene_pfade(tmp_path):
    admin = tmp_path / "admin"
    admin.mkdir()
    (admin / "index.html").write_text("<html><body>\n</body></html>", encoding="utf-8")
    report = tmp_path / "cutover-report"
    report.mkdir()
    (report / "index.html").write_text("<html><body>\n</body></html>", encoding="utf-8")
    (tmp_path / "index.html").write_text("<html><body>\n</body></html>", encoding="utf-8")

    assert injector.main([str(tmp_path)]) == 0
    assert not beacon_aktiv((admin / "index.html").read_text(encoding="utf-8"))
    assert not beacon_aktiv((report / "index.html").read_text(encoding="utf-8"))
    assert beacon_aktiv((tmp_path / "index.html").read_text(encoding="utf-8"))


def test_injektor_meldet_seite_ohne_body(tmp_path):
    seite = tmp_path / "fragment.html"
    seite.write_text("<div>nur ein Fragment</div>", encoding="utf-8")
    assert injector.inject(seite) == "no-body"
    assert injector.main([str(seite)]) == 1
