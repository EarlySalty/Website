/* ──────────────────────────────────────────────────────────────
   Datengrundlage fuer den Objectives-Report.
   Quelle: oeffentlicher MCP-Server der Deadlock-API (match_player),
   Ranked, 13.08. bis 15.09.2026. Alle Aggregate stammen aus den
   Kapitel-Auswertungen in .tasks/2026-09-17-objectives-blogpost/data/,
   nichts ist hier von Hand nachgerechnet oder gerundet erfunden.
   ────────────────────────────────────────────────────────────── */

export const STAND = '2026-09-18';

export const META = {
  fenster_von: '2026-08-13',
  fenster_bis: '2026-09-15',
  matches: 523602,
  matches_qd: 523747,
  mcp_url: 'https://api.deadlock-api.com/v1/mcp',
};

/* Rangnamen gegen steam-flows/src/rank.rs geprueft (Zehnerstelle des
   average_badge = Rangstufe). Stufe 11 (Eternus) hat nur 490 Matches und
   ist mit Stufe 10 (Ascendant) zu einer Klasse zusammengelegt. */
export const RAENGE = [
  { stufe: '1', name: 'Initiate', kurz: 'Initiate' },
  { stufe: '2', name: 'Seeker', kurz: 'Seeker' },
  { stufe: '3', name: 'Alchemist', kurz: 'Alchem.' },
  { stufe: '4', name: 'Arcanist', kurz: 'Arcanist' },
  { stufe: '5', name: 'Ritualist', kurz: 'Ritualist' },
  { stufe: '6', name: 'Emissary', kurz: 'Emissary' },
  { stufe: '7', name: 'Archon', kurz: 'Archon' },
  { stufe: '8', name: 'Oracle', kurz: 'Oracle' },
  { stufe: '9', name: 'Phantom', kurz: 'Phantom' },
  { stufe: '10+11', name: 'Ascendant und Eternus', kurz: 'Asc/Et' },
];

/* ── Kapitel 1: Midboss (Rejuvenator) ─────────────────────────── */
export const MIDBOSS = {
  aggregat: {
    mit_midboss_prozent: 98.8,
    erster_claim_sekunden: 1511,
    siegquote_erster_claim: 75.2,
    steals_je_match: 0.25,
    steals_gesamt: 128398,
    siegquote_nach_steal: 43.2,
    abandon_prozent: 3.98,
  },
  stufen: [
    { stufe: '1', erster_claim_sekunden: 1727, siegquote_erster_claim: 76.2, steals_je_match: 0.19, siegquote_nach_steal: 44.5 },
    { stufe: '2', erster_claim_sekunden: 1675, siegquote_erster_claim: 76.7, steals_je_match: 0.21, siegquote_nach_steal: 43.9 },
    { stufe: '3', erster_claim_sekunden: 1620, siegquote_erster_claim: 76.4, steals_je_match: 0.22, siegquote_nach_steal: 42.9 },
    { stufe: '4', erster_claim_sekunden: 1576, siegquote_erster_claim: 76.1, steals_je_match: 0.23, siegquote_nach_steal: 43.1 },
    { stufe: '5', erster_claim_sekunden: 1538, siegquote_erster_claim: 75.5, steals_je_match: 0.23, siegquote_nach_steal: 42.4 },
    { stufe: '6', erster_claim_sekunden: 1496, siegquote_erster_claim: 75.1, steals_je_match: 0.25, siegquote_nach_steal: 43.0 },
    { stufe: '7', erster_claim_sekunden: 1451, siegquote_erster_claim: 74.5, steals_je_match: 0.26, siegquote_nach_steal: 43.6 },
    { stufe: '8', erster_claim_sekunden: 1359, siegquote_erster_claim: 73.8, steals_je_match: 0.29, siegquote_nach_steal: 42.7 },
    { stufe: '9', erster_claim_sekunden: 1240, siegquote_erster_claim: 72.5, steals_je_match: 0.33, siegquote_nach_steal: 43.1 },
    { stufe: '10+11', erster_claim_sekunden: 1139, siegquote_erster_claim: 71.9, steals_je_match: 0.39, siegquote_nach_steal: 43.0 },
  ],
};

/* ── Kapitel 2: Soul Urn ──────────────────────────────────────── */
export const URNE = {
  aggregat: {
    mit_abgabe_prozent: 99.9,
    abgaben_je_team_je_match: 1.90,
    erste_abgabe_sekunden: 902,
    siegquote_erste_abgabe: 55.3,
    siegquote_mehr_abgaben: 68.3,
    gleichstand_matches: 11736,
    gleichstand_prozent: 2.2,
  },
  stufen: [
    { stufe: '1', siegquote_erste_abgabe: 57.0, siegquote_mehr_abgaben: 73.8 },
    { stufe: '2', siegquote_erste_abgabe: 57.1, siegquote_mehr_abgaben: 74.2 },
    { stufe: '3', siegquote_erste_abgabe: 56.8, siegquote_mehr_abgaben: 73.0 },
    { stufe: '4', siegquote_erste_abgabe: 56.5, siegquote_mehr_abgaben: 71.7 },
    { stufe: '5', siegquote_erste_abgabe: 56.7, siegquote_mehr_abgaben: 70.7 },
    { stufe: '6', siegquote_erste_abgabe: 56.2, siegquote_mehr_abgaben: 68.8 },
    { stufe: '7', siegquote_erste_abgabe: 55.0, siegquote_mehr_abgaben: 66.3 },
    { stufe: '8', siegquote_erste_abgabe: 53.3, siegquote_mehr_abgaben: 61.8 },
    { stufe: '9', siegquote_erste_abgabe: 49.8, siegquote_mehr_abgaben: 56.1 },
    { stufe: '10+11', siegquote_erste_abgabe: 47.9, siegquote_mehr_abgaben: 53.4 },
  ],
};

/* ── Kapitel 3: Shrines (TitanShieldGenerator) ────────────────── */
export const SHRINE = {
  aggregat: {
    mit_shrinefall_prozent: 100.0,
    erster_fall_sekunden: 1944,
    siegquote_erster_zerstoerer: 93.1,
    luecke_bis_ende_sekunden: 289,
    gefallene_gesamt: 1146494,
    verlierer_besitz_prozent: 91.3,
  },
  stufen: [
    { stufe: '1', erster_fall_sekunden: 2149, siegquote_erster_zerstoerer: 93.7, luecke_bis_ende_sekunden: 279 },
    { stufe: '2', erster_fall_sekunden: 2089, siegquote_erster_zerstoerer: 93.8, luecke_bis_ende_sekunden: 277 },
    { stufe: '3', erster_fall_sekunden: 2027, siegquote_erster_zerstoerer: 93.7, luecke_bis_ende_sekunden: 279 },
    { stufe: '4', erster_fall_sekunden: 1983, siegquote_erster_zerstoerer: 93.3, luecke_bis_ende_sekunden: 285 },
    { stufe: '5', erster_fall_sekunden: 1951, siegquote_erster_zerstoerer: 93.3, luecke_bis_ende_sekunden: 287 },
    { stufe: '6', erster_fall_sekunden: 1918, siegquote_erster_zerstoerer: 93.0, luecke_bis_ende_sekunden: 294 },
    { stufe: '7', erster_fall_sekunden: 1887, siegquote_erster_zerstoerer: 92.9, luecke_bis_ende_sekunden: 297 },
    { stufe: '8', erster_fall_sekunden: 1821, siegquote_erster_zerstoerer: 92.2, luecke_bis_ende_sekunden: 307 },
    { stufe: '9', erster_fall_sekunden: 1735, siegquote_erster_zerstoerer: 92.3, luecke_bis_ende_sekunden: 293 },
    { stufe: '10+11', erster_fall_sekunden: 1680, siegquote_erster_zerstoerer: 92.9, luecke_bis_ende_sekunden: 271 },
  ],
};

/* ── Kapitel 4: Unstable Rift (Nullbefund) ────────────────────── */
export const RIFT = {
  messbar: false,
};

/* ── Kapitel 5: Reihenfolge und Kombination ───────────────────── */
export const REIHENFOLGE = {
  aggregat: {
    alle_drei_events: 517380,
    anteil_alle_drei_prozent: 98.8,
    urne_zuerst_prozent: 99.2,
    midboss_zuerst_prozent: 0.8,
    shrine_zuerst_faelle: 45,
    siegquote_mehrheit: 84.2,
    verteilung: [
      { anzahl: 3, prozent: 40.2 },
      { anzahl: 2, prozent: 44.0 },
      { anzahl: 1, prozent: 13.4 },
      { anzahl: 0, prozent: 2.4 },
    ],
  },
  stufen: [
    { stufe: '1', siegquote_mehrheit: 85.3 },
    { stufe: '2', siegquote_mehrheit: 85.6 },
    { stufe: '3', siegquote_mehrheit: 85.4 },
    { stufe: '4', siegquote_mehrheit: 85.1 },
    { stufe: '5', siegquote_mehrheit: 84.7 },
    { stufe: '6', siegquote_mehrheit: 84.2 },
    { stufe: '7', siegquote_mehrheit: 83.7 },
    { stufe: '8', siegquote_mehrheit: 82.7 },
    { stufe: '9', siegquote_mehrheit: 81.4 },
    { stufe: '10+11', siegquote_mehrheit: 81.2 },
  ],
};

/* ── Kapitel 6: Kontrolle, Soul-Vorsprung zum Ereigniszeitpunkt ─
   Aggregate ueber alle Raenge, Siegquote des Ereignis-Teams je Klasse.
   Beobachtung, keine Wirkung: die Ereigniszeitpunkte sind nicht
   randomisiert, der Soul-Vorsprung ist selbst eine Folge des Spiels. */
export const KONTROLLE = {
  midboss: {
    label: 'Erster Rejuvenator',
    vorn: { siegquote: 89.5, n: 233797 },
    gleich: { siegquote: 70.8, n: 199036 },
    hinten: { siegquote: 45.7, n: 84608 },
  },
  shrine: {
    label: 'Erster Shrine-Fall',
    vorn: { siegquote: 96.2, n: 371145 },
    gleich: { siegquote: 87.9, n: 125342 },
    hinten: { siegquote: 75.7, n: 27255 },
  },
  urne: {
    label: 'Erste Urnen-Abgabe',
    vorn: { siegquote: 71.9, n: 161906 },
    gleich: { siegquote: 55.7, n: 189184 },
    hinten: { siegquote: 38.0, n: 160019 },
  },
};

/* ── Kapitel 7 (Seite: Kapitel 8): Siegquote nach Zeitpunkt ────
   Je Zeitklasse und Ranggruppe, plus Schichtung nach Soul-Vorsprung.
   A2-Lauf 2026-09-18. Prozente aus dem Lauf, Mediane als Rohsekunden.
   Beobachtung, keine Wirkung: die Zeitklassen sind nicht randomisiert. */
export const KAPITEL7 = {
  ranggruppen: {
    niedrig: 'Initiate bis Arcanist',
    mittel: 'Ritualist bis Archon',
    hoch: 'Oracle bis Eternus',
  },
  midboss: {
    label: 'Erster Rejuvenator',
    median_niedrig_s: 1714,
    median_hoch_s: 1127,
    klassen: [
      { label: '5 bis 20 min', gesamt: 72.9, niedrig: 74.2, mittel: 73.0, hoch: 72.7, steal_anteil: 12.9, sch: { vorn: 87.2, gleich: 67.3, hinten: 43.4 } },
      { label: '20 bis 25 min', gesamt: 73.8, niedrig: 75.0, mittel: 73.9, hoch: 72.5, steal_anteil: 10.8, sch: { vorn: 88.8, gleich: 68.8, hinten: 44.2 } },
      { label: '25 bis 30 min', gesamt: 76.3, niedrig: 76.4, mittel: 76.1, hoch: 76.4, steal_anteil: 8.3, sch: { vorn: 90.5, gleich: 72.4, hinten: 47.1 } },
      { label: '30 bis 35 min', gesamt: 78.1, niedrig: 78.2, mittel: 77.9, hoch: 77.7, steal_anteil: 7.5, sch: { vorn: 91.6, gleich: 74.4, hinten: 48.9 } },
      { label: 'ab 35 min', gesamt: 78.1, niedrig: 78.1, mittel: 78.7, hoch: 81.2, steal_anteil: 6.8, sch: { vorn: 90.9, gleich: 74.9, hinten: 48.7 } },
    ],
  },
  shrine: {
    label: 'Erster Shrine-Fall',
    median_niedrig_s: 2119,
    median_hoch_s: 1687,
    klassen: [
      { label: 'bis 20 min', gesamt: 98.7, niedrig: 99.6, mittel: 98.8, hoch: 98.1, steal_anteil: null, sch: { vorn: 99.4, gleich: 94.2, hinten: 77.3 } },
      { label: '20 bis 25 min', gesamt: 96.4, niedrig: 98.2, mittel: 97.0, hoch: 95.2, steal_anteil: null, sch: { vorn: 97.8, gleich: 91.2, hinten: 75.2 } },
      { label: '25 bis 30 min', gesamt: 94.6, niedrig: 96.3, mittel: 94.7, hoch: 93.0, steal_anteil: null, sch: { vorn: 96.9, gleich: 89.9, hinten: 76.0 } },
      { label: '30 bis 35 min', gesamt: 92.9, niedrig: 94.2, mittel: 92.6, hoch: 91.0, steal_anteil: null, sch: { vorn: 95.9, gleich: 87.8, hinten: 75.1 } },
      { label: '35 bis 40 min', gesamt: 91.8, niedrig: 92.8, mittel: 91.1, hoch: 89.8, steal_anteil: null, sch: { vorn: 95.5, gleich: 86.8, hinten: 75.4 } },
      { label: '40 bis 45 min', gesamt: 89.9, niedrig: 90.4, mittel: 89.4, hoch: 87.7, steal_anteil: null, sch: { vorn: 94.1, gleich: 86.7, hinten: 77.0 } },
      { label: '45 bis 50 min', gesamt: 87.1, niedrig: 87.5, mittel: 86.3, hoch: 83.9, steal_anteil: null, sch: { vorn: 91.8, gleich: 84.3, hinten: 76.8 } },
      { label: 'ab 50 min', gesamt: 82.9, niedrig: 82.6, mittel: 84.9, hoch: 84.4, steal_anteil: null, sch: { vorn: 87.5, gleich: 80.8, hinten: 75.5 } },
    ],
  },
  urne: {
    label: 'Erste Urnen-Abgabe',
    median_niedrig_s: 900,
    median_hoch_s: 900,
    klassen: [
      { label: 'bis 12 min', gesamt: 52.7, niedrig: 55.1, mittel: 53.8, hoch: 47.4, steal_anteil: null, sch: { vorn: 68.7, gleich: 53.4, hinten: 38.3 } },
      { label: '12 bis 15 min', gesamt: 55.7, niedrig: 57.1, mittel: 56.3, hoch: 52.6, steal_anteil: null, sch: { vorn: 72.3, gleich: 56.1, hinten: 38.1 } },
      { label: '15 bis 20 min', gesamt: 56.4, niedrig: 58.9, mittel: 55.7, hoch: 52.0, steal_anteil: null, sch: { vorn: 75.9, gleich: 57.8, hinten: 34.5 } },
      { label: 'über 20 min', gesamt: 59.9, niedrig: 60.7, mittel: 59.8, hoch: 58.4, steal_anteil: null, sch: { vorn: 84.9, gleich: 58.2, hinten: 30.4 } },
    ],
  },
};

/* ── Kapitel 8 (Seite: Kapitel 9): Der Urnen-Läufer ────────────
   Läufer = Spieler mit dem groessten gold_treasure-Zuwachs im Abgabe-
   Intervall, nur in 38,5 Prozent der Abgaben eindeutig. A3-Lauf 2026-09-18.
   Alle Läufer-Werte gelten nur fuer die erkennbaren Faelle. */
export const KAPITEL8 = {
  abgaben_gesamt: 1986811,
  bekannt_gesamt_prozent: 38.5,
  ranggruppen: [
    { key: 'niedrig', label: 'Initiate bis Arcanist', bekannt: 40.9, siegquote: 69.8, ueber_median: 63.2, median_vorsprung: 3487, rang12: 35.7, rang56: 30.9, tode_abgabe: 6.5, tode_sonst: 10.2, swing_median: 6055, swing_sonst: 3070 },
    { key: 'mittel', label: 'Ritualist bis Archon', bekannt: 38.0, siegquote: 69.1, ueber_median: 62.8, median_vorsprung: 3382, rang12: 35.3, rang56: 30.9, tode_abgabe: 6.5, tode_sonst: 10.1, swing_median: 5576, swing_sonst: 3034 },
    { key: 'hoch', label: 'Oracle bis Eternus', bekannt: 34.3, siegquote: 67.3, ueber_median: 63.1, median_vorsprung: 3367, rang12: 35.5, rang56: 30.3, tode_abgabe: 6.9, tode_sonst: 10.7, swing_median: 4715, swing_sonst: 3129 },
  ],
  ueber_median_rund: 63,
  calico_faktor: { niedrig: 1.36, mittel: 2.02, hoch: 2.64 },
  helden_hoch: [
    { name: 'Calico', faktor: 2.64 },
    { name: 'Drifter', faktor: 1.38 },
    { name: 'Paradox', faktor: 1.23 },
    { name: 'Mo & Krill', faktor: 1.22 },
    { name: 'Mina', faktor: 1.14 },
    { name: 'Lash', faktor: 1.13 },
  ],
  helden_niedrig: [
    { name: 'Celeste', faktor: 1.45 },
    { name: 'Graves', faktor: 1.33 },
  ],
};

export const QUELLEN = [
  'Alle Zahlen aus dem oeffentlichen MCP-Server der Deadlock-API (POST https://api.deadlock-api.com/v1/mcp, Tool execute_query, nur lesend), Tabelle match_player.',
  'Grundgesamtheit: game_mode Normal, match_mode Ranked, match_outcome TeamWin, 13.08. bis 15.09.2026 UTC, 523.602 Matches im Auswertungslauf.',
  'Rang aus average_badge (Zehnerstelle = Stufe), Rangnamen gegen die verifizierte Zuordnung aus dem Steam-Bot geprueft.',
  'Urnen-Abgaben sind eine abgeleitete Regel auf dem Checkpoint-Raster, keine Spiel-Telemetrie; an 20 Zufalls-Matches von Hand gegengeprueft.',
  'Siegquoten sind Teamvergleiche ohne Kausalitaetsaussage; nur die Schichtung nach Soul-Vorsprung schichtet zusaetzlich.',
];
