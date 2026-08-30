/**
 * Zahlen zum Blogpost "Zwei Jahre Discord, und wo das hier hin soll".
 *
 * Erhoben am 30.08.2026 aus der zentralen Postgres (deadlock, twitch_analytics)
 * und git log origin/main der sieben Projekte. Nur Aggregate, keine Namen.
 *
 * Mitglieder sind um Bot-Zuflüsse bereinigt: present, nicht is_bot, und ohne
 * die fünf Spike-Tage 24./25./28.10.2025, 25.11.2025, 21.02.2026 (gleiche
 * Regel wie /transparenz/, Stichtag dort 31.07.2026).
 *
 * Werte stehen als Literale: die Seite ist statisch. Beim nächsten Stichtag
 * diesen Block ersetzen, nicht ergänzen.
 */

export const STAND = '30.08.2026';

/** Monat | neue bereinigte Mitglieder, die am Stichtag noch da sind. */
export const JOINS = [
  ['2024-09', 1], ['2024-11', 4], ['2024-12', 15],
  ['2025-01', 29], ['2025-02', 24], ['2025-03', 19], ['2025-04', 21],
  ['2025-05', 21], ['2025-06', 23], ['2025-07', 19], ['2025-08', 65],
  ['2025-09', 38], ['2025-10', 45], ['2025-11', 36], ['2025-12', 42],
  ['2026-01', 97], ['2026-02', 289], ['2026-03', 212], ['2026-04', 148],
  ['2026-05', 140], ['2026-06', 104], ['2026-07', 127], ['2026-08', 156],
];

/** Monat | Sitzungen | Stunden (kaufmännisch gerundet). Aufzeichnung ab 24.11.2025. */
export const VOICE = [
  ['2025-11', 611, 392], ['2025-12', 3063, 2338], ['2026-01', 3612, 2137],
  ['2026-02', 10666, 3678], ['2026-03', 12099, 5113], ['2026-04', 13648, 4723],
  ['2026-05', 14325, 4222], ['2026-06', 6094, 3403], ['2026-07', 6497, 4064],
  ['2026-08', 8254, 4702],
];

/** Projekt | Commits auf origin/main | davon August 2026. */
export const REPOS = [
  ['Discord-Bots', 2967, 128],
  ['Twitch-Bot', 3115, 647],
  ['Steam-Bot', 508, 35],
  ['Website', 427, 87],
  ['Turniere', 247, 12],
  ['Deadlock-Brain', 142, 2],
  ['Patchnotes-Bot', 110, 15],
];

const joinSumme = JOINS.reduce((a, [, n]) => a + n, 0);
const voiceStunden = VOICE.reduce((a, [, , h]) => a + h, 0);
const voiceSitzungen = VOICE.reduce((a, [, s]) => a + s, 0);
const commits = REPOS.reduce((a, [, n]) => a + n, 0);
const commitsAugust = REPOS.reduce((a, [, , n]) => a + n, 0);

export const NUM = {
  mitglieder: joinSumme,
  joinsAugust: 156,
  voiceStunden,
  voiceSitzungen,
  voiceKanaele: 2063,
  voiceHeute: 736,
  coPairs: 29887,
  vcBans: 36,
  vcBanOwner: 8,
  steamAuftraege: 3013729,
  steamLinks: 536,
  partnerAktiv: 60,
  partnerSessions: 3393,
  raidsOk: 1510,
  coachingAnfragen: 90,
  coachingSessions: 71,
  coachesAktiv: 7,
  turniere: 4,
  turnierTeams: 21,
  bracketMatches: 25,
  scrimPool: 64,
  scrimTeams: 4,
  scrimMatches: 2,
  commits,
  commitsAugust,
  twitchAugust: 647,
  plusPreis: '2,50',
  stand: STAND,
  faqSessions: 14,
};
