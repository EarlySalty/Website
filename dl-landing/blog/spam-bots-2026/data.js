export const STAND = '2026-09-03';

export const META = {
  vorfaelle: 793,
  konten: 784,
  zeitraum: '2026-02 bis 2026-09',
  quellen: { ban_events: 390, autoban: 84, regex: 317, chat_mod: 2 },
};

export const MONATE = [
  { monat: '2026-02', kanaele: 170, nachrichten: 30865, gesamt: 47, chat: 47, je10k: 15.23 },
  { monat: '2026-03', kanaele: 186, nachrichten: 32497, gesamt: 62, chat: 62, je10k: 19.08 },
  { monat: '2026-04', kanaele: 27, nachrichten: 6229, gesamt: 111, chat: 11, je10k: 17.66 },
  { monat: '2026-05', kanaele: 25, nachrichten: 6333, gesamt: 94, chat: 31, je10k: 48.95 },
  { monat: '2026-06', kanaele: 28, nachrichten: 16198, gesamt: 73, chat: 0, je10k: 0.0, luecke: true },
  { monat: '2026-07', kanaele: 127, nachrichten: 50906, gesamt: 193, chat: 55, je10k: 10.8 },
  { monat: '2026-08', kanaele: 227, nachrichten: 77331, gesamt: 196, chat: 102, je10k: 13.19 },
  { monat: '2026-09', kanaele: 44, nachrichten: 6678, gesamt: 17, chat: 11, je10k: 16.47 },
];

export const VERFREMDUNG_GESAMT = 753;

export const VERFREMDUNG_FORMEN = [
  { schluessel: 'punkt_getrennt', name: 'Punkt oder Wort statt Punkt im Domainnamen', color: '#c8a86b' },
  { schluessel: 'math_smallcaps', name: 'Mathematische und Kleinkapitälchen-Zeichen', color: '#55978f' },
  { schluessel: 'keine_verfremdung', name: 'Keine Verfremdung', color: '#9a9488' },
  { schluessel: 'leerzeichen_in_domain', name: 'Leerzeichen im Domainnamen', color: '#e2c98d' },
  { schluessel: 'homoglyph', name: 'Kyrillische Zwillingsbuchstaben', color: '#b56a44' },
  { schluessel: 'zero_width', name: 'Unsichtbare Zeichen', color: '#6d6a63' },
];

export const VERFREMDUNG = [
  { monat: '2026-02', texte: 47, keine_verfremdung: 20, leerzeichen_in_domain: 0, punkt_getrennt: 27, math_smallcaps: 0, zero_width: 0, homoglyph: 0 },
  { monat: '2026-03', texte: 62, keine_verfremdung: 0, leerzeichen_in_domain: 0, punkt_getrennt: 62, math_smallcaps: 0, zero_width: 0, homoglyph: 0 },
  { monat: '2026-04', texte: 99, keine_verfremdung: 37, leerzeichen_in_domain: 0, punkt_getrennt: 60, math_smallcaps: 0, zero_width: 0, homoglyph: 2 },
  { monat: '2026-05', texte: 91, keine_verfremdung: 32, leerzeichen_in_domain: 3, punkt_getrennt: 15, math_smallcaps: 41, zero_width: 0, homoglyph: 0 },
  { monat: '2026-06', texte: 72, keine_verfremdung: 0, leerzeichen_in_domain: 0, punkt_getrennt: 64, math_smallcaps: 8, zero_width: 0, homoglyph: 0 },
  { monat: '2026-07', texte: 182, keine_verfremdung: 0, leerzeichen_in_domain: 0, punkt_getrennt: 182, math_smallcaps: 0, zero_width: 0, homoglyph: 0 },
  { monat: '2026-08', texte: 184, keine_verfremdung: 2, leerzeichen_in_domain: 0, punkt_getrennt: 182, math_smallcaps: 0, zero_width: 0, homoglyph: 0 },
  { monat: '2026-09', texte: 16, keine_verfremdung: 0, leerzeichen_in_domain: 0, punkt_getrennt: 16, math_smallcaps: 0, zero_width: 0, homoglyph: 0 },
];

export const MARKEN = [
  { marke: 'streamboo', erstauftritt: '2026-02-12', vorfaelle: 607, kanaele: 155, lebensdauer: 202, fragment: '2026-05-28' },
  { marke: 'twitchmax', erstauftritt: '2026-08-23', vorfaelle: 39, kanaele: 25, lebensdauer: 10, fragment: '2026-08-23' },
  { marke: 'topxy', erstauftritt: '2026-02-18', vorfaelle: 6, kanaele: 5, lebensdauer: 0, fragment: null },
  { marke: 'promotion', erstauftritt: '2026-07-13', vorfaelle: 5, kanaele: 5, lebensdauer: 38, fragment: '2026-08-16' },
  { marke: 'twitchstar', erstauftritt: '2026-08-22', vorfaelle: 5, kanaele: 5, lebensdauer: 0, fragment: '2026-08-22' },
  { marke: 'eballo', erstauftritt: '2026-07-11', vorfaelle: 2, kanaele: 1, lebensdauer: 0, fragment: '2026-07-11' },
  { marke: 'streamerbeat', erstauftritt: '2026-08-30', vorfaelle: 2, kanaele: 2, lebensdauer: 0, fragment: '2026-08-30' },
];

export const RU_DOMAINS = ['smmxl.ru', 'prmxy.ru', 'maxadsx.ru', 'reachon.ru'];

export const SCAM_MONATE = [
  { monat: '2026-06', clean: 32, unsure: 6, scam: 3 },
  { monat: '2026-07', clean: 124, unsure: 133, scam: 5 },
  { monat: '2026-08', clean: 131, unsure: 281, scam: 14 },
  { monat: '2026-09', clean: 16, unsure: 2, scam: 1 },
];

export const SCAM_KATEGORIEN = [
  { kategorie: 'Erst anfreunden, dann Pitch', vorfaelle: 12 },
  { kategorie: 'Reichweiten-Angebot', vorfaelle: 8 },
  { kategorie: 'Anfreunden per Smalltalk', vorfaelle: 3 },
];

export const SCAM_AKTIONEN = { none: 412, watching: 314, banned: 14, timed_out: 3, overturned: 2, suggested: 2, ban_failed_no_mod: 1 };

export const SCAM_PITCH = { konten: 19, median_nachrichten: 2, max: 239 };

export const SCAM_DISCORD = { gesamt: 24, mit_discord_bezug: 16 };

export const KONTOALTER = {
  spam: { n: 153, median: 13.8, q1: 2.0, q3: 744.9, le7: 44.4, le30: 56.2 },
  normal: { n: 4652, median: 2920.0, q1: 2190.7, q3: 3617.1, le7: 2.1, le30: 3.2 },
};

export const GELOESCHT = {
  spam: { fehlend: 325, angefragt: 479, anteil: 67.8 },
  normal: { fehlend: 348, angefragt: 5000, anteil: 7.0 },
};

export const NAMENSMUSTER = {
  spam: { n: 784, laenge: 19.0, ziffernanteil: 4.2, zufallsschwanz: 25.9 },
  normal: { n: 4652, laenge: 9.0, ziffernanteil: 0.0, zufallsschwanz: 9.7 },
};

export const VERHALTEN = { konten: 489, kanaele_median: 1, kanaele_max: 81, nachrichten_median: 1, nachrichten_p90: 2 };

export const BANRATE = [
  { monat: '2026-07', vorfaelle: 193, mit_aktion: 139, anteil: 72.0 },
  { monat: '2026-08', vorfaelle: 196, mit_aktion: 95, anteil: 48.5 },
  { monat: '2026-09', vorfaelle: 17, mit_aktion: 6, anteil: 35.3 },
];

export const REAKTIONSZEIT = { paare: 131, median: 0.7, p90: 1.3 };

export const PFADE = { spam: 162, scam: 16, global_ban: 2, scam_guard_bans: 14 };

export const FEHLALARME = { regex_geprueft: 45, regex_harmlos: 38, regex_spam: 7, overturned: 2, safe_patterns: 10 };

export const GLOBAL_BANLISTE = { konten: 24, anwendungen: 1264, kanaele: 59 };

export const METHODIK = {
  massentbannung: 1171,
};
