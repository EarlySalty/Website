#!/usr/bin/env python3
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NAV = ROOT / "dl-brand" / "nav.js"
CSS = ROOT / "dl-brand" / "nav.css"
SPEC = ROOT / "dl-brand" / "speculation.json"
SITEMAP = ROOT / "dl-landing" / "public" / "sitemap.xml"
CADDY = Path("/home/nathanael/repos/Caddy/hosts/v50671/Caddyfile")
FAQ_TPL = Path("/home/nathanael/repos/Deadlock-Docs/tools/faq_template.html")
FAQ_OUT = Path("/home/nathanael/repos/Deadlock-Docs/site/index.html")


class PreferredSourceContract(unittest.TestCase):
    def test_nav_lazy_loads_google_script_and_has_deeplink(self) -> None:
        source = NAV.read_text(encoding="utf-8")
        self.assertIn("Als bevorzugte Quelle merken", source)
        self.assertIn("https://news.google.com/swg/js/v1/publisher.js", source)
        self.assertIn("preferred-sources-control", source)
        self.assertIn("https://www.google.com/preferences/source?q=deutsche-deadlock-community.de", source)
        self.assertIn("theme: 'dark'", source)
        self.assertIn("lang: 'de'", source)
        self.assertIn("mountPreferredSource()", source)
        self.assertNotIn("—", source)
        self.assertNotIn("ae ", source)
        self.assertIn("häufiger", source)
        self.assertIn("/twitch/", source)
        self.assertIn("addEventListener('click'", source)

    def test_google_script_is_not_in_initial_html_pages(self) -> None:
        homepage = (ROOT / "deco-elevator-new" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("news.google.com", homepage)
        self.assertIn("/brand/nav.js", homepage)

    def test_css_styles_the_button(self) -> None:
        css = CSS.read_text(encoding="utf-8")
        self.assertIn(".brand-preferred-source", css)
        self.assertIn(".brand-preferred-btn", css)

    def test_speculation_rules_exclude_apps(self) -> None:
        data = json.loads(SPEC.read_text(encoding="utf-8"))
        prerender = data["prerender"][0]
        self.assertEqual(prerender["eagerness"], "moderate")
        blob = json.dumps(prerender)
        self.assertIn("/twitch/*", blob)
        self.assertIn("/uplink/*", blob)
        self.assertIn("nofollow", blob)

    def test_sitemap_keeps_docs_and_adds_beitreten(self) -> None:
        xml = SITEMAP.read_text(encoding="utf-8")
        self.assertIn("https://deutsche-deadlock-community.de/beitreten/", xml)
        self.assertIn("https://deutsche-deadlock-community.de/docs/", xml)
        self.assertIn("https://deutsche-deadlock-community.de/blog/twitch-szene-2026/", xml)
        self.assertIn("https://deutsche-deadlock-community.de/faq/", xml)
        self.assertGreaterEqual(xml.count("<url>"), 20)

    def test_caddy_allows_google_on_public_html_not_dashboards(self) -> None:
        text = CADDY.read_text(encoding="utf-8")
        self.assertIn('Speculation-Rules `"/brand/speculation.json"`', text)
        self.assertGreaterEqual(text.count("https://news.google.com"), 6)
        dashboard = None
        for line in text.splitlines():
            if "clips-media-assets2.twitch.tv" in line and "Content-Security-Policy" in line:
                dashboard = line
        self.assertIsNotNone(dashboard)
        self.assertNotIn("news.google.com", dashboard)

    def test_faq_template_loads_brand_nav(self) -> None:
        tpl = FAQ_TPL.read_text(encoding="utf-8")
        self.assertIn("/brand/nav.js", tpl)
        self.assertIn("/brand/nav.css", tpl)


if __name__ == "__main__":
    unittest.main()
