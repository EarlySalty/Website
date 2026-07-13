#!/usr/bin/env python3
"""Vertragstests für die /mitspieler/-Seite mit Server-Gebäude.

Prüft, dass der interaktive Turm vollständig verdrahtet ist, der
Tracking-Invite der Seite unverändert bleibt und die SEO-Basics
den Neubau überlebt haben.
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "dl-landing/mitspieler/index.html"
SITE_JS = ROOT / "dl-landing/src/site.js"
SITE_CSS = ROOT / "dl-landing/src/site.css"

FLOORS = ["dach", "4f", "3f", "2f", "1f", "eg"]
MITSPIELER_INVITE = "discord.gg/GrdVBQtf2y"


class TowerMarkupTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_tower_section_exists(self) -> None:
        self.assertIn("data-tower", self.html)
        self.assertIn('id="server"', self.html)
        self.assertIn("tower-svg", self.html)

    def test_all_floors_wired(self) -> None:
        for floor in FLOORS:
            with self.subTest(floor=floor):
                self.assertIn(f'data-floor-btn="{floor}"', self.html)
                self.assertIn(f'data-floor-detail="{floor}"', self.html)
                self.assertIn(f'data-floor="{floor}"', self.html)
                self.assertIn(f'data-floor-live="{floor}"', self.html)
                self.assertIn(f'data-floor-count="{floor}"', self.html)

    def test_tabs_are_accessible(self) -> None:
        self.assertIn('role="tablist"', self.html)
        self.assertEqual(self.html.count('role="tab"'), len(FLOORS))
        self.assertEqual(self.html.count('role="tabpanel"'), len(FLOORS))

    def test_live_strip_present(self) -> None:
        self.assertIn("data-live-root", self.html)
        self.assertIn("data-lanes-list", self.html)
        self.assertIn("data-presence-grid", self.html)

    def test_hero_stats_present(self) -> None:
        self.assertIn('data-stat="members"', self.html)
        self.assertIn('data-stat="online"', self.html)


class InviteTrackingTest(unittest.TestCase):
    """Der Invite pro Seite ist ein Tracking-Link und darf nie wechseln."""

    def test_mitspieler_invite_unchanged(self) -> None:
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn(MITSPIELER_INVITE, html)
        other_invites = set(re.findall(r"discord\.gg/([A-Za-z0-9]+)", html))
        self.assertEqual(other_invites, {"GrdVBQtf2y"})


class SeoTest(unittest.TestCase):
    def test_seo_basics_survived(self) -> None:
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn('rel="canonical" href="https://deutsche-deadlock-community.de/mitspieler/"', html)
        self.assertIn("application/ld+json", html)
        self.assertIn("<h1>", html)
        self.assertIn("BreadcrumbList", html)


class SiteJsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.js = SITE_JS.read_text(encoding="utf-8")

    def test_voice_counts_derived_from_members(self) -> None:
        # Die Widget-API hat kein members_count am Channel; Belegung kommt
        # aus members[].channel_id. Regression: nie wieder members_count lesen.
        self.assertIn("channel_id", self.js)
        self.assertNotRegex(self.js, r"\.members_count")

    def test_tower_functions_wired(self) -> None:
        self.assertIn("function setupTower", self.js)
        self.assertIn("function updateTowerLive", self.js)
        self.assertIn("setupTower()", self.js)
        # Alle Etagen tauchen im Zähl-Objekt auf, unbekannte Voice-Channels
        # landen als Default auf 2F.
        for floor in FLOORS:
            self.assertRegex(self.js, rf"['\"]?{floor}['\"]?\s*:")
        self.assertIn("return '2f'", self.js)


class SiteCssTest(unittest.TestCase):
    def test_tower_styles_present(self) -> None:
        css = SITE_CSS.read_text(encoding="utf-8")
        for cls_name in [".tower-wrap", ".tower-btn", ".tw-wins", ".tower-detail", ".tower-live"]:
            self.assertIn(cls_name, css)


if __name__ == "__main__":
    unittest.main()
