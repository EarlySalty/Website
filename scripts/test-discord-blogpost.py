#!/usr/bin/env python3
"""Verträge des Discord-Briefs: eine Quelle, gleiche Zahl an jeder Stelle."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "dl-landing" / "wohin" / "index.html"
DATA = ROOT / "dl-landing" / "wohin" / "data.js"
REDIR = ROOT / "dl-landing" / "blog" / "discord-zukunft" / "index.html"
NAV = ROOT / "dl-brand" / "nav.js"
VITE = ROOT / "dl-landing" / "vite.config.js"
SITEMAP = ROOT / "dl-landing" / "public" / "sitemap.xml"
ROBOTS = ROOT / "dl-landing" / "public" / "robots.txt"
BLOG = ROOT / "dl-landing" / "blog" / "index.html"
LLMS = ROOT / "dl-landing" / "public" / "llms.txt"
LLMS_FULL = ROOT / "dl-landing" / "public" / "llms-full.txt"


def de(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def js_array(name: str, source: str) -> list:
    match = re.search(rf"export const {name} = (\[.*?\]);", source, re.DOTALL)
    if not match:
        raise AssertionError(f"Datenblock {name} nicht gefunden")
    body = match.group(1)
    body = re.sub(r"//[^\n]*", "", body)
    body = re.sub(r"'", '"', body)
    body = re.sub(r",(\s*[\]\}])", r"\1", body)
    return json.loads(body)


class DiscordBrief(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = PAGE.read_text(encoding="utf-8")
        cls.data = DATA.read_text(encoding="utf-8")
        cls.joins = js_array("JOINS", cls.data)
        cls.voice = js_array("VOICE", cls.data)
        cls.repos = js_array("REPOS", cls.data)
        cls.mitglieder = sum(v for _, v in cls.joins)
        cls.stunden = sum(h for _, _, h in cls.voice)
        cls.sitzungen = sum(s for _, s, _ in cls.voice)
        cls.commits = sum(t for _, t, _ in cls.repos)
        cls.august = sum(a for _, _, a in cls.repos)

    def test_kacheln_folgen_den_summen(self):
        self.assertIn(f'data-count="{self.mitglieder}"', self.page)
        self.assertIn(de(self.mitglieder), self.page)
        self.assertIn(f'data-count="{self.stunden}"', self.page)
        self.assertIn(de(self.stunden), self.page)
        self.assertIn('data-count="60"', self.page)
        self.assertIn('data-count="7"', self.page)

    def test_august_joins_stehen_in_der_reihe(self):
        by_month = dict(self.joins)
        self.assertEqual(by_month["2026-08"], 156)

    def test_twitch_august_ist_der_repo_wert(self):
        twitch = next(a for n, _, a in self.repos if n == "Twitch-Bot")
        self.assertIn(f"twitchAugust: {twitch}", self.data)

    def test_vite_kennt_den_post(self):
        self.assertIn("wohin/index.html", VITE.read_text(encoding="utf-8"))

    def test_sitemap_und_blogindex(self):
        self.assertIn("/wohin/", SITEMAP.read_text(encoding="utf-8"))
        self.assertIn("/wohin/", BLOG.read_text(encoding="utf-8"))

    def test_robots_allow_fuer_trainingscrawler(self):
        robots = ROBOTS.read_text(encoding="utf-8")
        self.assertGreaterEqual(robots.count("Allow: /wohin/"), 2)

    def test_alte_url_leitet_weiter(self):
        redir = REDIR.read_text(encoding="utf-8")
        self.assertIn("/wohin/", redir)
        self.assertIn("noindex", redir)

    def test_nav_kennt_wohin(self):
        self.assertIn("/wohin/", NAV.read_text(encoding="utf-8"))

    def test_llms_nennen_vorbehalte(self):
        full = LLMS_FULL.read_text(encoding="utf-8")
        short = LLMS.read_text(encoding="utf-8")
        for blob in (full, short):
            self.assertIn("/wohin/", blob)
            self.assertIn(de(self.mitglieder), blob)
        self.assertIn("Spike-Tage", full)
        self.assertIn("bleiben frei", full)

    def test_keine_gedankenstriche(self):
        self.assertNotIn("\u2014", self.page)
        self.assertNotIn("\u2013", self.page)

    def test_json_ld_hat_blogposting(self):
        self.assertIn('"BlogPosting"', self.page)
        self.assertIn("de-DE", self.page)
        self.assertIn("2026-08-30T18:00:00+02:00", self.page)

    def test_og_bild_ist_das_logo(self):
        self.assertIn("/images/og-logo.png", self.page)
        self.assertIn("summary_large_image", self.page)


if __name__ == "__main__":
    unittest.main()
