#!/usr/bin/env python3
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EMOJI = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")


class Phase2bSubpagesContractTest(unittest.TestCase):
    def test_activity_sources_contain_no_default_emoji(self) -> None:
        for path in (ROOT / "dl-activity/index.html", ROOT / "dl-activity/src/activity.js"):
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertNotRegex(path.read_text(), EMOJI)

    def test_mitspieler_uses_deco_backgrounds(self) -> None:
        html = (ROOT / "dl-landing/mitspieler/index.html").read_text()
        self.assertIn("/images/hero-mitspieler-deco.png", html)
        self.assertIn("/new/assets/deco/fight-posters.png", html)
        self.assertNotIn("hero-rooftops.png", html)
        self.assertNotIn("hotel-hall-dark", html)

    def test_mitspieler_keeps_its_discord_invite(self) -> None:
        html = (ROOT / "dl-landing/mitspieler/index.html").read_text()
        self.assertIn("https://discord.gg/GrdVBQtf2y", html)

    def test_activity_tabs_use_inline_deco_icons(self) -> None:
        html = (ROOT / "dl-activity/index.html").read_text()
        tabs = re.search(r'<nav class="page-tabs".*?</nav>', html, re.DOTALL)
        self.assertIsNotNone(tabs)
        self.assertGreaterEqual(tabs.group(0).count("<svg"), 4)


if __name__ == "__main__":
    unittest.main()
