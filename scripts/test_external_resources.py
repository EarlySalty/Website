"""Sicherheitsverträge für externe und inline Web-Ressourcen.

Der manuell eingebundene Cloudflare-Beacon hatte keine pinbare Version und
konnte deshalb nicht belastbar mit Subresource Integrity abgesichert werden.
Diese Suite verhindert seine Rückkehr und prüft alle HTML-Quellen sowie bereits
gebaute Artefakte auf ungesicherte externe Ressourcen.
"""

import base64
import binascii
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

REPO = Path(__file__).resolve().parent.parent
IGNORED_PARTS = {".git", "graphify-out", "node_modules"}
EXECUTABLE_SCRIPT_TYPES = {
    "",
    "application/ecmascript",
    "application/javascript",
    "application/x-ecmascript",
    "application/x-javascript",
    "module",
    "text/ecmascript",
    "text/javascript",
    "text/javascript1.0",
    "text/javascript1.1",
    "text/javascript1.2",
    "text/javascript1.3",
    "text/javascript1.4",
    "text/javascript1.5",
    "text/jscript",
    "text/livescript",
    "text/x-ecmascript",
    "text/x-javascript",
}
SUPPORTED_SRI_DIGEST_LENGTHS = {"sha256": 32, "sha384": 48, "sha512": 64}
ASCII_WHITESPACE_PATTERN = re.compile(r"[^\t\n\f\r ]+")
C0_CONTROL_OR_SPACE = "".join(chr(codepoint) for codepoint in range(0x21))
SCANNED_STYLE_PAGES = [
    "deco-elevator-new/index.html",
    "dl-coaching/index.html",
    "dl-landing/coaching/index.html",
    "dl-landing/mitspieler/index.html",
    "dl-patch/index.html",
]
SCANNED_STYLE_PAGES += [
    rel
    for rel in (
        "dl-coaching/dist/index.html",
        "dl-landing/dist/mitspieler/index.html",
        "dl-patch/dist/index.html",
    )
    if (REPO / rel).exists()
]
PATCH_HERO_PAGES = sorted(
    str(path.relative_to(REPO))
    for path in (REPO / "dl-patch/public/hero").glob("*.html")
)


class ResourceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.external_scripts: list[dict[str, str]] = []
        self.external_stylesheets: list[dict[str, str]] = []
        self.stylesheet_hrefs: list[str] = []
        self.script_sources: list[str] = []
        self.inline_executable_scripts = 0
        self.inline_script_attributes = 0
        self.inline_styles = 0
        self.style_attributes = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes: dict[str, str] = {}
        for name, value in attrs:
            # Bei doppelten Attributen wertet der Browser das erste aus. Ein
            # späteres sicheres src darf ein vorheriges fremdes nicht maskieren.
            attributes.setdefault(name.lower(), value or "")
        tag = tag.lower()
        self.inline_script_attributes += sum(
            name.startswith("on") or _javascript_url(value)
            for name, value in attributes.items()
        )
        if "style" in attributes:
            self.style_attributes += 1
        if tag == "style":
            self.inline_styles += 1
        if tag == "script":
            script_type = attributes.get("type", "").split(";", 1)[0].strip().lower()
            src = attributes.get("src", "")
            if src:
                self.script_sources.append(src)
            if src and _external(src) and script_type in EXECUTABLE_SCRIPT_TYPES:
                self.external_scripts.append(attributes)
            elif not src and script_type in EXECUTABLE_SCRIPT_TYPES:
                self.inline_executable_scripts += 1
        if tag == "link" and "stylesheet" in attributes.get("rel", "").lower().split():
            self.stylesheet_hrefs.append(attributes.get("href", ""))
            if _external(attributes.get("href", "")):
                self.external_stylesheets.append(attributes)


def _external(url: str) -> bool:
    normalized = _browser_url(url)
    return normalized.startswith("//") or urlsplit(normalized).scheme.lower() in {
        "http",
        "https",
    }


def _javascript_url(value: str) -> bool:
    return _browser_url(value).lower().startswith("javascript:")


def _browser_url(value: str) -> str:
    # Der URL-Parser des Browsers entfernt TAB/LF/CR überall sowie führende
    # und folgende C0-Steuerzeichen bzw. Leerzeichen vor der Schema-Prüfung.
    # Bei einer HTTPS-Basis behandelt er Backslashes wie Slashes; dadurch ist
    # auch ``\\cdn.example/app.js`` eine externe Netzpfad-Referenz.
    without_ascii_tabs_or_newlines = value.translate(
        {ord(character): None for character in "\t\n\r"}
    )
    return without_ascii_tabs_or_newlines.strip(C0_CONTROL_OR_SPACE).replace("\\", "/")


def _cloudflare_beacon(url: str) -> bool:
    normalized = _browser_url(url)
    parsed = urlsplit(
        f"https:{normalized}" if normalized.startswith("//") else normalized
    )
    return (
        parsed.hostname or ""
    ).lower() == "static.cloudflareinsights.com" and unquote(
        parsed.path
    ).lower().rstrip("/") == "/beacon.min.js"


def _valid_sri(value: str) -> bool:
    for token in ASCII_WHITESPACE_PATTERN.findall(value):
        digest_token = token.split("?", 1)[0]
        algorithm, separator, encoded = digest_token.partition("-")
        expected_length = SUPPORTED_SRI_DIGEST_LENGTHS.get(algorithm.lower())
        if not separator or expected_length is None or not encoded:
            continue

        # Die SRI-Grammatik erlaubt neben Base64 auch die URL-sicheren Zeichen
        # ``-`` und ``_`` sowie ausgelassene Auffüllung.
        normalized = encoded.replace("-", "+").replace("_", "/")
        normalized += "=" * (-len(normalized) % 4)
        try:
            digest = base64.b64decode(normalized, validate=True)
        except (binascii.Error, ValueError):
            continue
        if len(digest) == expected_length:
            return True
    return False


def _html_files() -> list[Path]:
    return sorted(
        path
        for path in REPO.rglob("*.html")
        if not IGNORED_PARTS.intersection(path.relative_to(REPO).parts)
    )


def _parse(path: Path) -> ResourceParser:
    parser = ResourceParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def test_keine_manuellen_cloudflare_beacons() -> None:
    fundstellen = [
        str(path.relative_to(REPO))
        for path in _html_files()
        if any(_cloudflare_beacon(src) for src in _parse(path).script_sources)
    ]
    assert not fundstellen, f"nicht pinbarer Cloudflare-Beacon in: {fundstellen}"


@pytest.mark.parametrize(
    "path", _html_files(), ids=lambda path: str(path.relative_to(REPO))
)
def test_externe_ressourcen_sind_mit_sri_abgesichert(path: Path) -> None:
    parser = _parse(path)
    unsichere = [
        attrs.get("src", "")
        for attrs in parser.external_scripts
        if not _valid_sri(attrs.get("integrity", "")) or "crossorigin" not in attrs
    ]
    unsichere += [
        attrs.get("href", "")
        for attrs in parser.external_stylesheets
        if not _valid_sri(attrs.get("integrity", "")) or "crossorigin" not in attrs
    ]
    assert not unsichere, f"externe Ressource ohne SRI und crossorigin: {unsichere}"


@pytest.mark.parametrize("rel", SCANNED_STYLE_PAGES)
def test_gescannte_seiten_brauchen_keine_unsafe_inline_styles(rel: str) -> None:
    parser = _parse(REPO / rel)
    assert parser.inline_styles == 0, f"{rel} enthält einen <style>-Block"
    assert parser.style_attributes == 0, f"{rel} enthält style-Attribute"


@pytest.mark.parametrize("rel", PATCH_HERO_PAGES)
def test_heldenseiten_laden_ihren_styleblock_aus_der_gemeinsamen_css_datei(
    rel: str,
) -> None:
    parser = _parse(REPO / rel)
    assert parser.inline_styles == 0, f"{rel} enthält einen <style>-Block"
    assert parser.stylesheet_hrefs.count("/patch/hero-shell.css") == 1, (
        f"{rel} lädt /patch/hero-shell.css nicht genau einmal"
    )
    assert (REPO / "dl-patch/public/hero-shell.css").is_file()


@pytest.mark.parametrize("rel", SCANNED_STYLE_PAGES)
def test_gescannte_seiten_brauchen_keine_unsafe_inline_scripts(rel: str) -> None:
    parser = _parse(REPO / rel)
    assert parser.inline_executable_scripts == 0, (
        f"{rel} enthält ausführbares Inline-JavaScript"
    )
    assert parser.inline_script_attributes == 0, (
        f"{rel} enthält Inline-Eventhandler oder javascript:-URLs"
    )


@pytest.mark.parametrize(
    ("algorithm", "length"),
    SUPPORTED_SRI_DIGEST_LENGTHS.items(),
)
def test_sri_pruefung_akzeptiert_nur_echte_digestwerte(
    algorithm: str, length: int
) -> None:
    digest = base64.b64encode(bytes(length)).decode("ascii")
    assert _valid_sri(f"{algorithm}-{digest}")
    assert not _valid_sri(f"{algorithm}-nicht-base64!!!")
    assert not _valid_sri(
        f"{algorithm}-{base64.b64encode(bytes(length - 1)).decode('ascii')}"
    )
    assert not _valid_sri("unsupported-anything")


def test_parser_erkennt_legacy_javascript_und_leeres_crossorigin() -> None:
    parser = ResourceParser()
    parser.feed(
        '<script type="application/x-javascript" src="https://cdn.example/app.js" '
        'integrity="sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" '
        "crossorigin></script>"
    )
    assert len(parser.external_scripts) == 1
    assert "crossorigin" in parser.external_scripts[0]


def test_parser_erkennt_externe_url_mit_browser_whitespace() -> None:
    parser = ResourceParser()
    parser.feed('<script src=" &#x09;//cdn.example/app.js"></script>')
    assert [attrs["src"] for attrs in parser.external_scripts] == [
        " \t//cdn.example/app.js"
    ]


def test_parser_erkennt_externe_url_mit_backslashes() -> None:
    parser = ResourceParser()
    parser.feed(r'<script src="\\cdn.example/app.js"></script>')
    assert [attrs["src"] for attrs in parser.external_scripts] == [
        r"\\cdn.example/app.js"
    ]


def test_parser_erkennt_inline_javascript_attribute() -> None:
    parser = ResourceParser()
    parser.feed('<a ONCLICK="run()" href="java&#x0A;script:run()">Link</a>')
    assert parser.inline_script_attributes == 2


@pytest.mark.parametrize("separator", ["\u00a0", "\u2003"])
def test_sri_pruefung_akzeptiert_nur_ascii_whitespace(separator: str) -> None:
    digest = base64.b64encode(bytes(SUPPORTED_SRI_DIGEST_LENGTHS["sha384"])).decode(
        "ascii"
    )
    assert not _valid_sri(f"ungueltig{separator}sha384-{digest}")


@pytest.mark.parametrize(
    "url",
    [
        "//STATIC.CLOUDFLAREINSIGHTS.COM/beacon.min.js",
        "https://static.cloudflareinsights.com/beacon.min.js?version=1",
        "https://static.cloudflareinsights.com/%62eacon.min.js",
        r"\\STATIC.CLOUDFLAREINSIGHTS.COM\beacon.min.js",
    ],
)
def test_cloudflare_beacon_erkennung_ist_strukturiert(url: str) -> None:
    assert _cloudflare_beacon(url)
