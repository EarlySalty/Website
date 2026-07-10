#!/usr/bin/env python3
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_SOURCES = [
    ROOT / "deco-elevator-new/index.html",
    ROOT / "dl-landing/index.html",
    *sorted((ROOT / "dl-landing").glob("*/index.html")),
    ROOT / "dl-landing/guides/anfaenger/index.html",
    ROOT / "dl-patch/index.html",
    ROOT / "dl-activity/index.html",
    ROOT / "dl-tierlist/index.html",
    ROOT / "dl-coaching/index.html",
]
BRAND_SOURCES = ("/brand/tokens.css", "/brand/nav.css", "/brand/nav.js")


class Phase1ElevatorContractTest(unittest.TestCase):
    def test_all_pages_include_brand_sources_once(self) -> None:
        for path in HTML_SOURCES:
            with self.subTest(path=path.relative_to(ROOT)):
                html = path.read_text()
                for source in BRAND_SOURCES:
                    self.assertEqual(html.count(source), 1, source)
                self.assertNotRegex(html, r'data-(?:brand-)?footer=["\']false["\']')

    def test_homepage_old_elevator_markup_is_removed(self) -> None:
        html = (ROOT / "deco-elevator-new/index.html").read_text()
        self.assertNotIn('class="elevator-nav"', html)
        self.assertNotIn('class="elevator-ride"', html)
        self.assertNotRegex(html, r"\.elevator-nav[^{}]*\{[^{}]*display:\s*none\s*!important")

    def test_shared_nav_guards_accessible_navigation(self) -> None:
        source = (ROOT / "dl-brand/nav.js").read_text()
        self.assertRegex(source, r"matchMedia\([^)]*prefers-reduced-motion:\s*reduce")
        for guard in ("event.ctrlKey", "event.metaKey", "event.shiftKey", "event.button !== 0"):
            with self.subTest(guard=guard):
                self.assertIn(guard, source)
        self.assertRegex(source, r"target\s*===\s*['\"]_blank['\"]")
        self.assertIn("aria-current", source)

    def test_old_elevator_css_is_removed(self) -> None:
        css = (ROOT / "deco-elevator-new/styles.css").read_text()
        self.assertNotRegex(css, r"\.elevator-[\w-]+")


if __name__ == "__main__":
    unittest.main()
