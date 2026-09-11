/* ──────────────────────────────────────────────────────────────
   Datengrundlage fuer den Meta-Report "Spirit Slop".
   Quellen: oeffentliche SteamDB-Monatswerte, Valves offizielle
   Patchnotes und zeitgenoessische Community-Chronologie. Kein
   eigener Telemetrie-Bestand, keine erfundenen Winrates.
   ────────────────────────────────────────────────────────────── */

export const STAND = '2026-09-11';

export const META = {
  zeitraum_von: '2025-03',
  zeitraum_bis: '2026-09',
  kipp_datum: '2025-07-04',
};

/* Durchschnittliche gleichzeitige Spieler je Monat, SteamDB.
   Luecken (Herbst 2025, Teile 2026) sind bewusst nicht erfunden. */
export const SPIELER = [
  { monat: '2025-03', wert: 19585 },
  { monat: '2025-04', wert: 15808 },
  { monat: '2025-05', wert: 22687 },
  { monat: '2025-06', wert: 17843 },
  { monat: '2025-07', wert: 15763 },
  { monat: '2025-08', wert: 60717 },
  { monat: '2025-09', wert: 62443 },
];

/* Spaetere Monatswerte als grobe Groessenordnung, nicht als saubere Reihe. */
export const SPIELER_2026 = [
  { monat: '2026-01', wert: 100558 },
  { monat: '2026-02', wert: 125665 },
  { monat: '2026-03', wert: 120267 },
  { monat: '2026-08', wert: 93081 },
];

export const SPIELER_STAND = {
  tiefpunkt_monat: '2025-07',
  tiefpunkt_wert: 15763,
  april_wert: 15808,
  hoch_monat: '2026-02',
  hoch_wert: 125665,
  recherchetag_ca: 60000,
};

/* Redaktioneller Meta-Pressure-Index: -3 stark gun-freundlich bis
   +3 stark Spirit-/Debuff-freundlich. Kein Valve- oder API-Wert. */
export const PRESSURE = [
  { datum: '2025-04-04', index: 0.0, effekt: 'gemischter Balancepatch' },
  { datum: '2025-04-17', index: 0.8, effekt: 'Anti-Debuff und mehrere Gun-Komponenten schwächer' },
  { datum: '2025-05-08', index: -1.8, effekt: 'Shop Rework, danach laut Community gun-lastige Phase' },
  { datum: '2025-06-17', index: 1.5, effekt: 'Headshots schwächer, Spirit Resistance runter' },
  { datum: '2025-07-04', index: 3.0, effekt: 'global minus 5 Prozent Gun-DPS, Spirit-Investment plus 25 Prozent', big: true },
  { datum: '2025-07-29', index: 2.6, effekt: 'Objective Spirit Resist entfernt, Debuff-Defense schwächer', big: true },
  { datum: '2025-09-04', index: 1.2, effekt: 'mehrere Spirit- und Control-Scaling-Buffs bei Helden' },
  { datum: '2025-11-21', index: 1.0, effekt: 'Gun-Falloff-Fehler korrigiert' },
  { datum: '2026-03-06', index: -2.2, effekt: 'breite Weapon-Item-Buffs', big: true },
  { datum: '2026-07-01', index: 0.7, effekt: 'erneute Spirit- und Shred-Synergie in einzelnen Kits' },
];

/* Verdichtete Chronologie fuer die Einstiegs-Zeitleiste. */
export const TIMELINE = [
  { zeit: 'März 2025', lage: 'rund 19,6k Spieler im Schnitt', urteil: 'noch kein eindeutiger Spirit Slop' },
  { zeit: 'April 2025', lage: 'rund 15,8k, Tiefphase', urteil: 'Burst- und Debuff-Frust, aber gemischte Meta' },
  { zeit: '8. Mai 2025', lage: 'Shop Rework', urteil: 'danach laut Community zeitweise eher Gun Meta' },
  { zeit: '17. Juni 2025', lage: 'systemische Vorstufe', urteil: 'Headshots schwächer, Spirit-Resists sinken' },
  { zeit: '4. Juli 2025', lage: 'rund 15,8k, praktisch am Tief', urteil: 'größter Spirit-Kippmoment' },
  { zeit: '29. Juli 2025', lage: 'Verstärkung', urteil: 'Anti-Debuff und Spirit-Defense schwächer' },
  { zeit: 'Aug bis Sep 2025', lage: 'über 60k Spieler', urteil: 'Spirit-Meta-Diskussion wird sehr deutlich' },
  { zeit: 'Herbst 2025', lage: 'Spirit und Hybrid etabliert', urteil: 'Beschwerden halten an' },
  { zeit: 'März 2026', lage: 'große Gun-Gegenbuffs', urteil: 'Gun bekommt Hilfe' },
  { zeit: 'Sommer 2026', lage: 'Hybrid-Spirit nimmt wieder zu', urteil: 'kein identischer 2025er Slop, aber ähnliche Anreize' },
];

/* Kernzahlen der drei entscheidenden Patches, direkt aus den Patchnotes. */
export const PATCHDETAIL = {
  juni17: [
    { was: 'Headshot-Multiplikator global', von: '1,9x', auf: '1,8x' },
    { was: 'Walker Spirit Resistance', von: '40 %', auf: '30 %' },
    { was: "Enchanter's Emblem Spirit Resistance", von: '18 %', auf: '15 %' },
    { was: 'Card Trick Spirit Scaling', von: '0,84', auf: '1,1' },
  ],
  juli04: [
    { was: 'Bullet Cycle Time (Gun-DPS global)', von: '', auf: 'rund 5 % weniger DPS' },
    { was: 'Spirit-Bonus aus Souls im Spirit Tree', von: '', auf: 'plus 25 %' },
    { was: 'Fortitude Weapon Damage', von: '+22 %', auf: 'entfernt' },
    { was: 'Swift Striker Fire Rate', von: '20 %', auf: '18 %' },
    { was: 'Walker Spirit Resistance', von: '30 %', auf: '25 %' },
  ],
  juli29: [
    { was: 'Objective Spirit Resistance', von: '20 bis 25 %', auf: 'entfernt' },
    { was: 'Debuff Remover Cooldown', von: '45 s', auf: '50 s' },
    { was: 'Spirit Resilience Spirit Resistance', von: '30 %', auf: '25 %' },
    { was: 'Spirit Sap Spirit Reduction', von: '15', auf: '18' },
    { was: 'Disarming Hex Cooldown', von: '', auf: 'auf 20 s gesenkt' },
  ],
};

export const HEUTE = {
  maerz_buffs: ['Extended Magazine', 'High-Velocity Mag', 'Long Range', 'Opening Rounds', 'Swift Striker', 'Ballistic Enchantment', 'Weighted Shots'],
  shiv_datum: '2026-07-01',
};

/* Zitierbare Kernaussagen, auch fuer llms-full.txt. */
export const QUELLEN = [
  'Spielerzahlen: oeffentliche SteamDB-Monatswerte (durchschnittliche gleichzeitige Spieler).',
  'Patchinhalte: Valves offizielle Deadlock-Patchnotes vom 4. April 2025 bis 1. Juli 2026.',
  'Community-Chronologie: zeitgenoessische Steam- und Forendiskussionen als Stimmungsbeleg, keine Telemetrie.',
  'Meta-Pressure-Index: eigene redaktionelle Einordnung je Patch, kein offizieller Wert.',
];
