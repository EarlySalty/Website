#!/usr/bin/env python3
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HEADER_SOURCES = [
    ROOT / "deco-elevator-new/index.html",
    ROOT / "dl-landing/index.html",
    *sorted(path for path in (ROOT / "dl-landing").glob("*/index.html") if path.parent.name != "dist"),
    ROOT / "dl-landing/guides/anfaenger/index.html",
    ROOT / "dl-patch/index.html",
    ROOT / "dl-activity/index.html",
    ROOT / "dl-tierlist/index.html",
]


def tracked_html() -> list[Path]:
    paths = subprocess.run(
        ["git", "ls-files", "*.html"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    return [ROOT / path for path in paths]


class Phase2WordmarkContractTest(unittest.TestCase):
    def test_wordmark_contains_only_the_deco_text_lockup(self) -> None:
        svg = (ROOT / "dl-brand/logo/wordmark.svg").read_text()
        self.assertIn('role="img"', svg)
        self.assertIn('aria-label="Deutsche Deadlock Community"', svg)
        self.assertIn(">DEUTSCHE DEADLOCK</text>", svg)
        self.assertIn(">COMMUNITY</text>", svg)
        self.assertNotIn("M35 4", svg)
        self.assertNotIn("M35 14", svg)
        self.assertNotIn("<circle", svg)

    def test_tracked_html_does_not_reference_old_deco_logos(self) -> None:
        for path in tracked_html():
            with self.subTest(path=path.relative_to(ROOT)):
                html = path.read_text()
                self.assertNotIn("community-logo-deco.svg", html)
                self.assertNotIn("community-icon-deco.svg", html)

    def test_public_headers_use_shared_logo_and_wordmark(self) -> None:
        for path in HEADER_SOURCES:
            with self.subTest(path=path.relative_to(ROOT)):
                html = path.read_text()
                header = re.search(r"<header\b.*?</header>", html, re.DOTALL).group(0)
                brand = re.search(r'<a class="brand[^"]*"[^>]*>.*?</a>', header, re.DOTALL).group(0)
                self.assertIn('href="/"', brand)
                self.assertIn('aria-label="Deutsche Deadlock Community"', brand)
                self.assertIn('src="/brand/logo/logo-192.png"', brand)
                self.assertIn('src="/brand/logo/wordmark.svg"', brand)

        coaching = (ROOT / "dl-coaching/src/components/Layout.tsx").read_text()
        brand = re.search(r'<Link to="/" className="brand-wordmark".*?</Link>', coaching, re.DOTALL).group(0)
        self.assertIn('aria-label="Deutsche Deadlock Community"', brand)
        self.assertIn('src="/brand/logo/logo-192.png"', brand)
        self.assertIn('src="/brand/logo/wordmark.svg"', brand)
        self.assertIn("Coaching-Etage", brand)

    def test_brand_logos_are_not_circle_clipped(self) -> None:
        css = (ROOT / "dl-coaching/src/index.css").read_text()
        brand_rules = "\n".join(re.findall(r"\.brand-wordmark[^{}]*\{[^}]*}", css, re.DOTALL))
        self.assertNotRegex(brand_rules, r"clip-path:\s*circle")
        self.assertNotRegex(brand_rules, r"border-radius:\s*999px")
        self.assertIn("object-fit: contain", brand_rules)


if __name__ == "__main__":
    unittest.main()
