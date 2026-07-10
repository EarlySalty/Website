#!/usr/bin/env python3
import html
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DISCORD_INVITE = "https://discord.gg/PhkP3WgY7w"
HOME_LINKS = {
    "/mitspieler/": "Mitspieler",
    "/coaching/": "Coaching",
    "/aktivitaet/": "Aktivität & Ränge",
    "/patch/": "Patchnotes",
    "/helden/": "Helden",
    "/streamer/": "Streamer",
    "/beitreten/": "Beitreten",
    "/builds/": "Builds",
    "/turnier/": "Turnier",
}
PATCH_TARGETS = {
    "/",
    "/mitspieler/",
    "/coaching/",
    "/aktivitaet/",
    "/helden/",
    "/streamer/",
    "/beitreten/",
    "/builds/",
    "/turnier/",
}


def footer(path: Path) -> str:
    return re.search(r"<footer\b.*?</footer>", path.read_text(), re.DOTALL).group(0)


def links(markup: str) -> dict[str, str]:
    return {
        href: html.unescape(re.sub(r"<[^>]+>", "", label).strip())
        for href, label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', markup, re.DOTALL)
    }


class Phase3FooterLinksContractTest(unittest.TestCase):
    def test_homepage_footer_has_labeled_page_links(self) -> None:
        markup = footer(ROOT / "deco-elevator-new/index.html")
        pages = re.search(r'<nav\b[^>]*aria-label="Seiten"[^>]*>.*?</nav>', markup, re.DOTALL)
        self.assertIsNotNone(pages)
        self.assertEqual(links(pages.group(0)), HOME_LINKS)

    def test_patch_footer_has_all_page_targets(self) -> None:
        self.assertTrue(PATCH_TARGETS.issubset(links(footer(ROOT / "dl-patch/index.html"))))

    def test_footer_discord_invites_stay_unchanged(self) -> None:
        for path in (ROOT / "deco-elevator-new/index.html", ROOT / "dl-patch/index.html"):
            with self.subTest(path=path.relative_to(ROOT)):
                discord_links = [href for href in links(footer(path)) if "discord.gg" in href]
                self.assertEqual(discord_links, [DISCORD_INVITE])


if __name__ == "__main__":
    unittest.main()
