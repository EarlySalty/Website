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

export const QUELLEN = [
  'Alle Zahlen aus dem oeffentlichen MCP-Server der Deadlock-API (POST https://api.deadlock-api.com/v1/mcp, Tool execute_query, nur lesend), Tabelle match_player.',
  'Grundgesamtheit: game_mode Normal, match_mode Ranked, match_outcome TeamWin, 13.08. bis 15.09.2026 UTC, 523.602 Matches im Auswertungslauf.',
  'Rang aus average_badge (Zehnerstelle = Stufe), Rangnamen gegen die verifizierte Zuordnung aus dem Steam-Bot geprueft.',
  'Urnen-Abgaben sind eine abgeleitete Regel auf dem Checkpoint-Raster, keine Spiel-Telemetrie; an 20 Zufalls-Matches von Hand gegengeprueft.',
  'Siegquoten sind Teamvergleiche ohne Kausalitaetsaussage; nur die Schichtung nach Soul-Vorsprung schichtet zusaetzlich.',
];
