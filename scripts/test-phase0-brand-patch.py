#!/usr/bin/env python3
import re
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FAVICON = '<link rel="icon" type="image/png" href="/brand/logo/favicon-64.png">'
HTML_SOURCES = [
    ROOT / "deco-elevator-new/index.html",
    ROOT / "dl-landing/index.html",
    *sorted((ROOT / "dl-landing").glob("*/index.html")),
    ROOT / "dl-patch/index.html",
    ROOT / "dl-activity/index.html",
    ROOT / "dl-tierlist/index.html",
    ROOT / "dl-coaching/index.html",
]


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"{path} is not a PNG")
    return struct.unpack(">II", data[16:24])


class Phase0ContractTest(unittest.TestCase):
    def test_optimized_logo_sizes(self) -> None:
        self.assertEqual(png_size(ROOT / "dl-brand/logo/favicon-64.png"), (64, 64))
        self.assertEqual(png_size(ROOT / "dl-brand/logo/logo-192.png"), (192, 192))

    def test_source_html_uses_shared_favicon(self) -> None:
        for path in HTML_SOURCES:
            with self.subTest(path=path.relative_to(ROOT)):
                html = path.read_text()
                self.assertIn(FAVICON, html)
                self.assertNotRegex(html, r'href="(?:%BASE_URL%)?favicon\.svg|/new/assets/logos/favicon\.svg')

    def test_header_logos_use_optimized_variant(self) -> None:
        sources = [*HTML_SOURCES, ROOT / "dl-coaching/src/components/Layout.tsx"]
        for path in sources:
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertNotRegex(path.read_text(), r'(?:src=|import\s+\w+\s+from\s+)["\'{]/?[^"\']*deadlock-d-logo\.png')

    def test_patch_header_uses_shared_logo(self) -> None:
        patch_html = (ROOT / "dl-patch/index.html").read_text()
        self.assertRegex(patch_html, r'<a class="brand[^"]*" href="/"[^>]*>\s*<img src="/brand/logo/logo-192\.png"')

    def test_elevator_effects_keep_images_stable_and_colored(self) -> None:
        css = (ROOT / "deco-elevator-new/styles.css").read_text()
        grain = re.search(r"\.grain\s*\{([^}]*)\}", css, re.DOTALL)
        self.assertIsNotNone(grain)
        grain_body = grain.group(1)
        self.assertNotIn("animation:", grain_body)
        self.assertLessEqual(float(re.search(r"opacity:\s*([\d.]+)", grain_body).group(1)), 0.03)

        vignette = re.search(r"^\.vignette\s*\{([^}]*)\}", css, re.DOTALL | re.MULTILINE).group(1)
        self.assertLessEqual(max(map(float, re.findall(r"rgba\([^)]*,\s*([\d.]+)\)", vignette))), 0.24)

        for value in map(float, re.findall(r"sepia\(([\d.]+)\)", css)):
            self.assertLessEqual(value, 0.08)
        for value in map(float, re.findall(r"saturate\(([\d.]+)\)", css)):
            self.assertGreaterEqual(value, 0.95)
        for value in map(float, re.findall(r"brightness\(([\d.]+)\)", css)):
            self.assertGreaterEqual(value, 0.9)

    def test_landing_grain_is_static_and_subtle(self) -> None:
        # Gleicher Flacker-Fix wie im Aufzug (#50): Film-Grain darf als Textur
        # bleiben, aber nie animiert sein — das springende Noise wirkt als
        # Flackern auf dunklen Flächen.
        css = (ROOT / "dl-landing/src/site.css").read_text()
        before = re.search(r"html::before\s*\{([^}]*)\}", css, re.DOTALL)
        self.assertIsNotNone(before)
        body = before.group(1)
        self.assertNotIn("animation:", body)
        self.assertLessEqual(float(re.search(r"opacity:\s*([\d.]+)", body).group(1)), 0.03)
        self.assertNotRegex(css, r"@keyframes\s+grain\b")

    def test_patch_renders_before_deferred_asset_catalog(self) -> None:
        source = (ROOT / "dl-patch/src/patch.js").read_text()
        dashboard = re.search(r"async function loadDashboard\(\)\s*\{(.*?)\n\}", source, re.DOTALL).group(1)
        render_at = dashboard.index("render()")
        defer_at = dashboard.index("window.setTimeout")
        assets_at = dashboard.index("loadAssetCatalog()", defer_at)
        self.assertLess(render_at, defer_at)
        self.assertLess(defer_at, assets_at)

if __name__ == "__main__":
    unittest.main()
