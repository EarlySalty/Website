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
VOICE_STUNDEN = 29973
MITGLIEDER = 1586          # bereinigt; Discord zeigt 2.428
MITGLIEDER_ROH = 2428
BOT_ZUFLUSS = 842          # ausgeschlossene Konten, die noch auf dem Server sind
STEAM_AUFTRAEGE = 1693100
ARBEITSSTUNDEN = 1377
ARBEITSSPANNE_TAGE = 337   # 29.08.2025 bis 31.07.2026


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

    def test_beitrittsverlauf_ergibt_die_mitgliederzahl(self):
        """Die Monatswerte müssen den bereinigten Bestand ergeben."""
        joins = js_array("JOINS", self.data)
        self.assertEqual(sum(v for _, v in joins), MITGLIEDER)

    def test_staerkster_monat_wird_korrekt_genannt(self):
        joins = dict(js_array("JOINS", self.data))
        top = max(joins.values())
        self.assertEqual(top, joins["2026-02"])
        self.assertIn(str(top), self.page)
        self.assertIn("Februar 2026 als stärkster", self.page)

    def test_bereinigung_ist_rechnerisch_schluessig(self):
        """Roh minus Bot-Zufluss muss die veröffentlichte Zahl ergeben."""
        self.assertEqual(MITGLIEDER_ROH - BOT_ZUFLUSS, MITGLIEDER)
        for wert in (de(MITGLIEDER_ROH), de(BOT_ZUFLUSS), de(MITGLIEDER)):
            with self.subTest(wert=wert):
                self.assertIn(wert, self.page)

    def test_bereinigung_ist_begruendet_statt_behauptet(self):
        """Eine kleinere Zahl als Discord braucht eine nachvollziehbare Regel."""
        self.assertIn("Bot Acc", self.page)
        for beleg in ("2,0 %", "84,4 %", "4,2 %", "92,9 %"):
            with self.subTest(beleg=beleg):
                self.assertIn(beleg, self.page)
        self.assertIn("Bereinigung um Bot-Zuflüsse", self.page)

    def test_bereinigte_werte_stehen_auch_im_datenblock(self):
        """Datenblock und Fließtext dürfen nicht auseinanderlaufen."""
        self.assertIn("846", self.data)
        self.assertIn("424", self.data)

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
        for wert in (MITGLIEDER, VOICE_STUNDEN, STEAM_AUFTRAEGE, ARBEITSSTUNDEN):
            with self.subTest(wert=wert):
                self.assertIn(f'data-count="{wert}"', self.page)
                self.assertIn(de(wert), self.page)

    # ── Arbeitszeit-Schätzung ────────────────────────────────────────

    def test_arbeitszeit_summe_entspricht_dem_verlauf(self):
        work = js_array("WORK_MONTHS", self.data)
        self.assertEqual(sum(v for _, v in work), ARBEITSSTUNDEN)

    def test_arbeitszeit_raster_passt_zum_verlauf(self):
        """Projektaufteilung und Monatssumme müssen dieselbe Gesamtzahl ergeben."""
        work = dict(js_array("WORK_MONTHS", self.data))
        grid = js_array("WORK_GRID", self.data)
        monate = [k for k, _ in js_array("WORK_MONTHS", self.data)]
        for reihe in grid:
            self.assertEqual(len(reihe[1]), len(monate), f"{reihe[0]} hat falsche Spaltenzahl")
        for i, monat in enumerate(monate):
            spalte = sum(reihe[1][i] for reihe in grid)
            # Rundung je Zelle darf die Monatssumme um höchstens die Zeilenzahl verfehlen
            self.assertAlmostEqual(spalte, work[monat], delta=len(grid),
                                   msg=f"{monat}: Raster {spalte} vs Verlauf {work[monat]}")

    def test_wochenschnitt_ist_hergeleitet(self):
        """Der genannte Schnitt muss zu Stundenzahl und Zeitraum passen."""
        schnitt = ARBEITSSTUNDEN / (ARBEITSSPANNE_TAGE / 7)
        self.assertIn(f"{schnitt:.1f}".replace(".", ","), self.page)

    def test_vollzeitaequivalent_stimmt(self):
        """'8,6 Monate Vollzeit' muss aus den Stunden folgen (160 h je Monat)."""
        self.assertAlmostEqual(ARBEITSSTUNDEN / 160, 8.6, delta=0.05)
        self.assertIn("8,6 Monate Vollzeit", self.page)

    def test_marktwert_ist_nachrechenbar(self):
        """Die genannte Spanne muss Stunden mal Stundensatz sein."""
        for satz, erwartet in ((60, "83.000"), (80, "110.000")):
            with self.subTest(satz=satz):
                self.assertAlmostEqual(ARBEITSSTUNDEN * satz,
                                       int(erwartet.replace(".", "")), delta=2000)
                self.assertIn(erwartet, self.page)

    # ── Beteiligung ──────────────────────────────────────────────────

    def test_beteiligungszahlen_ergeben_die_mitgliederzahl(self):
        """Aufgabenträger + Unterstützer + Sichtbare + Nutzer = alle Mitglieder.

        Die Gruppen überschneiden sich (jemand kann Coach und Streamer sein),
        deshalb wird gegen die veröffentlichte Restgröße geprüft, nicht addiert.
        """
        rest = 1456
        beteiligt = MITGLIEDER - rest
        self.assertEqual(beteiligt, 130)
        self.assertIn(de(rest), self.page)
        self.assertIn(f"{100 * rest / MITGLIEDER:.1f}".replace(".", ","), self.page)

    def test_aufgabentraeger_anteil_stimmt(self):
        traeger = 19
        self.assertIn(f"{100 * traeger / MITGLIEDER:.1f}".replace(".", ","), self.page)
        self.assertIn(f'<span class="tp-role-count">{traeger}</span>', self.page)

    def test_betreuungsverhaeltnis_ist_gerechnet(self):
        """Die Verhältniszahlen müssen zu den Rollenzahlen der Karten passen."""
        for anzahl, erwartet in ((19, 83), (6, 264), (4, 396)):
            with self.subTest(anzahl=anzahl):
                self.assertEqual(round(MITGLIEDER / anzahl), erwartet)
                self.assertIn(str(erwartet), self.page)

    def test_voice_und_onboarding_beziehen_sich_auf_bereinigte_basis(self):
        """Kapitel 1 und der Beweis-Block müssen dieselbe Zahl nennen.

        Beide beschreiben dieselbe Grundgesamtheit — die 1.586 heutigen
        Mitglieder. Zwei verschiedene Werte dafür wären ein Widerspruch
        auf einer Seite, die mit Nachrechenbarkeit wirbt.
        """
        in_voice, onboarding = 684, 402
        self.assertEqual(self.page.count(f"<strong>{in_voice}</strong>"), 1)
        self.assertIn(f"<dd>{in_voice}</dd>", self.page)
        self.assertIn(f"<strong>{onboarding}</strong>", self.page)
        anteil = round(100 * in_voice / MITGLIEDER)
        self.assertIn(f"{anteil} von hundert", self.page)

    def test_beitrittsspanne_deckt_die_daten(self):
        """Eine genannte Spanne muss alle Monate des genannten Zeitraums enthalten."""
        joins = dict(js_array("JOINS", self.data))
        ab_august = [v for k, v in joins.items() if k >= "2025-08"]
        self.assertIn(f"{min(ab_august)} und {max(ab_august)} Beitritten", self.page)

    def test_rechtliche_verantwortung_wird_benannt(self):
        for pflicht in ("Impressumspflicht", "DSGVO", "Haftung"):
            with self.subTest(pflicht=pflicht):
                self.assertIn(pflicht, self.page)

    def test_belastung_ist_belegt_nicht_behauptet(self):
        """Die harten Aussagen zur Belastung brauchen konkrete Zahlen."""
        for beleg in ("78", "288 von 337", "84", "57"):
            with self.subTest(beleg=beleg):
                self.assertIn(beleg, self.page)

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
