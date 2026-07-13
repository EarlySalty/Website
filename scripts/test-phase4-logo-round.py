#!/usr/bin/env python3
import struct
import unittest
import zlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class Phase4ContractTest(unittest.TestCase):
    def test_logos_are_round_with_transparent_corners(self) -> None:
        for name, size in (("favicon-64.png", 64), ("logo-192.png", 192)):
            with self.subTest(name=name):
                im = Image.open(ROOT / "dl-brand/logo" / name)
                self.assertEqual(im.size, (size, size))
                self.assertEqual(im.mode, "RGBA")
                for p in [(0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)]:
                    self.assertEqual(im.getpixel(p)[3], 0, f"Ecke {p} nicht transparent")
                self.assertGreater(im.getpixel((size // 2, size // 2))[3], 0)

    def test_wordmark_rendered_larger(self) -> None:
        checks = [
            ("dl-landing/src/site.css", "height: 54px"),
            ("deco-elevator-new/styles.css", "height: 54px"),
            ("dl-patch/src/patch.css", "height: 54px"),
            ("dl-activity/src/main.css", "height: 54px"),
            ("dl-tierlist/src/main.css", "height: 54px"),
            ("dl-coaching/src/index.css", "height: 36px"),
        ]
        for path, needle in checks:
            with self.subTest(path=path):
                self.assertIn(needle, (ROOT / path).read_text())

    def test_no_box_shadow_on_round_logo(self) -> None:
        css = (ROOT / "dl-landing/src/site.css").read_text()
        brand_logo = css.split(".brand-logo {", 1)[1].split("}", 1)[0]
        self.assertNotIn("box-shadow", brand_logo)

    def test_hotel_hall_dark_fully_removed(self) -> None:
        self.assertFalse((ROOT / "deco-elevator-new/assets/deco/hotel-hall-dark.png").exists())
        for f in [ROOT / "dl-landing/mitspieler/index.html", ROOT / "deco-elevator-new/styles.css"]:
            self.assertNotIn("hotel-hall-dark", f.read_text())
        self.assertTrue((ROOT / "dl-landing/public/images/hero-mitspieler-deco.png").exists())


if __name__ == "__main__":
    unittest.main()
