#!/usr/bin/env python3
"""Verträge der Transparenz-Seite.

Die Seite behauptet, ihre Zahlen seien nachprüfbar. Damit das stimmt, muss
jede Zahl im Fließtext zu der im Datenblock passen — sonst widerspricht die
Seite sich selbst, und genau das würde niemandem auffallen. Die Tests hier
sichern die Stellen ab, an denen dieselbe Zahl mehrfach auftaucht, plus die
Verdrahtung (Build-Eingang, Sitemap, Navigation).
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "dl-landing" / "transparenz" / "index.html"
DATA = ROOT / "dl-landing" / "transparenz" / "transparenz.js"
VITE = ROOT / "dl-landing" / "vite.config.js"
SITEMAP = ROOT / "dl-landing" / "public" / "sitemap.xml"
NAV = ROOT / "dl-brand" / "nav.js"

# Die Kennzahlen, die auf der Seite als Aussage stehen. Quelle: Erhebung 31.07.2026.
COMMITS_GESAMT = 6550
COMMITS_JULI = 2064
VOICE_STUNDEN = 30008
MITGLIEDER = 2428
STEAM_AUFTRAEGE = 1693100


def de(n: int) -> str:
    """1693100 -> '1.693.100' (deutsche Tausendertrennung wie auf der Seite)."""
    return f"{n:,}".replace(",", ".")


def js_array(name: str, source: str) -> list:
    """Liest ein Literal-Array aus der Datendatei und gibt es als Python-Liste."""
    match = re.search(rf"const {name} = (\[.*?\]);", source, re.DOTALL)
    if not match:
        raise AssertionError(f"Datenblock {name} nicht gefunden")
    body = match.group(1)
    body = re.sub(r"//[^\n]*", "", body)          # Kommentarzeilen raus
    body = re.sub(r"'", '"', body)                # JS-Quotes -> JSON
    body = re.sub(r",(\s*[\]\}])", r"\1", body)   # Trailing Commas raus
    return json.loads(body)


class TransparenzSeite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = PAGE.read_text(encoding="utf-8")
        cls.data = DATA.read_text(encoding="utf-8")

    # ── Die Zahlen müssen zueinander passen ──────────────────────────

    def test_commit_summe_entspricht_dem_verlauf(self):
        """Die Kachel-Zahl ist die Summe des Monatsverlaufs, nicht daneben."""
        commits = js_array("COMMITS", self.data)
        self.assertEqual(sum(v for _, v in commits), COMMITS_GESAMT)

    def test_juli_wert_stimmt_mit_dem_verlauf(self):
        commits = dict(js_array("COMMITS", self.data))
        self.assertEqual(commits["2026-07"], COMMITS_JULI)

    def test_juni_und_juli_behauptung_stimmt(self):
        """Der Text nennt eine Summe für Juni+Juli — die muss aus den Daten folgen."""
        commits = dict(js_array("COMMITS", self.data))
        summe = commits["2026-06"] + commits["2026-07"]
        self.assertIn(de(summe), self.page)
        self.assertGreater(summe, COMMITS_GESAMT / 2, "Text behauptet 'mehr als die Hälfte'")

    def test_projektsummen_ergeben_die_gesamtzahl(self):
        repos = js_array("REPOS", self.data)
        self.assertEqual(sum(total for _, total, _ in repos), COMMITS_GESAMT)
        self.assertEqual(sum(juli for _, _, juli in repos), COMMITS_JULI)

    def test_beitritte_2026_stimmen_mit_dem_verlauf(self):
        """Die Kachel nennt die Beitritte des laufenden Jahres."""
        joins = js_array("JOINS", self.data)
        summe_2026 = sum(v for k, v in joins if k.startswith("2026"))
        self.assertIn(de(summe_2026), self.page)

    def test_sprachstunden_summe_passt_zur_kachel(self):
        """Die aufgezeichneten Monate dürfen die Gesamtzahl nicht überschreiten."""
        voice = js_array("VOICE", self.data)
        self.assertLessEqual(sum(h for _, _, h in voice), VOICE_STUNDEN)

    def test_nachtanteil_stimmt(self):
        """'30,9 % nachts' muss aus der Stundenverteilung folgen."""
        hours = js_array("HOURS", self.data)
        self.assertEqual(len(hours), 24)
        self.assertEqual(sum(hours), COMMITS_GESAMT)
        anteil = sum(hours[:6]) / sum(hours) * 100
        self.assertIn(f"{anteil:.1f}".replace(".", ","), self.page)

    def test_kennzahlen_stehen_im_hero(self):
        for wert in (MITGLIEDER, VOICE_STUNDEN, STEAM_AUFTRAEGE, COMMITS_GESAMT):
            with self.subTest(wert=wert):
                self.assertIn(f'data-count="{wert}"', self.page)
                self.assertIn(de(wert), self.page)

    # ── Verdrahtung ──────────────────────────────────────────────────

    def test_seite_ist_build_eingang(self):
        self.assertIn("transparenz/index.html", VITE.read_text(encoding="utf-8"))

    def test_seite_steht_in_der_sitemap(self):
        self.assertIn("/transparenz/", SITEMAP.read_text(encoding="utf-8"))

    def test_seite_haengt_in_der_navigation(self):
        self.assertIn("/transparenz/", NAV.read_text(encoding="utf-8"))
        self.assertIn("/transparenz/", self.page, "Footer verlinkt die eigene Seite")

    def test_datendatei_wird_eingebunden(self):
        self.assertIn("transparenz.js", self.page)

    # ── Zusagen der Seite an die Leser ───────────────────────────────

    def test_jedes_diagramm_hat_eine_tabellenansicht(self):
        """Zugänglichkeit: Diagramme mit Umschalter brauchen ein Tabellenziel."""
        toggles = set(re.findall(r'data-table-for="([^"]+)"', self.page))
        targets = set(re.findall(r'data-table="([^"]+)"', self.page))
        self.assertTrue(toggles)
        self.assertEqual(toggles, targets)

    def test_stichtag_ist_einheitlich(self):
        self.assertIn("31. Juli 2026", self.page)
        self.assertIn("31.07.2026", self.data)

    def test_methodik_benennt_die_luecken(self):
        """Ohne offengelegte Grenzen ist die Seite Marketing, keine Transparenz."""
        for pflicht in ("Hauptzweig", "Aufzeichnung", "Selbstauskunft"):
            with self.subTest(pflicht=pflicht):
                self.assertIn(pflicht, self.page)

    def test_keine_personenbezogenen_daten(self):
        """Auf der öffentlichen Seite dürfen keine Discord- oder Steam-IDs stehen."""
        for treffer in re.findall(r"\b\d{17,19}\b", self.page):
            self.fail(f"Mögliche Discord-/Steam-ID auf der Seite: {treffer}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
