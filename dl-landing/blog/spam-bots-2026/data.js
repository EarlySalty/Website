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

export const REAKTIONSZEIT = { paare: 132, median: 0.7, p90: 1.3 };

export const PFADE = { spam: 162, scam: 16, global_ban: 2, scam_guard_bans: 14 };

export const FEHLALARME = { regex_geprueft: 45, regex_harmlos: 38, regex_spam: 7, overturned: 2, safe_patterns: 10 };

export const GLOBAL_BANLISTE = { konten: 24, anwendungen: 1264, kanaele: 59 };

export const METHODIK = {
  massentbannung: 1171,
};

export const CHAT_GESAMT = 550;

export const BEISPIELE = {
  spam_texte_je_monat: [
    {"monat": "2026-02", "spam_nachrichten": 46, "haeufigste_normalform": {"text": "Cheap Viewers streamboo .com (remove the space)", "vorkommen": 1}, "auffaelligste_verfremdung": {"text": "Viewers streamboo .com  [Name]", "formen": ["punkt_getrennt"]}},
    {"monat": "2026-03", "spam_nachrichten": 65, "haeufigste_normalform": {"text": "[Name] Top Viewers streamboo .com", "vorkommen": 5}, "auffaelligste_verfremdung": {"text": "[Name] Top Viewers streamboo .com", "formen": ["punkt_getrennt"]}},
    {"monat": "2026-04", "spam_nachrichten": 11, "haeufigste_normalform": {"text": "Cheapest Viewers cheapviewers2.ru  [Name]", "vorkommen": 1}, "auffaelligste_verfremdung": {"text": "Тор Viеwеrs streаmviеwers .org [Name]", "formen": ["homoglyph", "punkt_getrennt"]}},
    {"monat": "2026-05", "spam_nachrichten": 31, "haeufigste_normalform": {"text": "Ai viewers streaｍboo .com", "vorkommen": 25}, "auffaelligste_verfremdung": {"text": "𝗩𝗶𝗲𝘄𝗲𝗿𝘀 s t r e a m b o o . c o m", "formen": ["leerzeichen_in_domain", "math_smallcaps", "punkt_getrennt"]}},
    {"monat": "2026-07", "spam_nachrichten": 147, "haeufigste_normalform": {"text": "Ai viewers streamboo . Com", "vorkommen": 135}, "auffaelligste_verfremdung": {"text": "Best Viewers Eballo .com (remove the space)", "formen": ["punkt_getrennt"]}},
    {"monat": "2026-08", "spam_nachrichten": 231, "haeufigste_normalform": {"text": "Ai viewers streamboo. Com", "vorkommen": 166}, "auffaelligste_verfremdung": {"text": "Best promotion on streamboo. org", "formen": ["punkt_getrennt"]}},
    {"monat": "2026-09", "spam_nachrichten": 19, "haeufigste_normalform": {"text": "Ai viewers twitchmax .com", "vorkommen": 10}, "auffaelligste_verfremdung": {"text": "Ai viewers streamboo . Com", "formen": ["punkt_getrennt"]}},
  ],
  logins: ["rottenroyalistz", "sarcasticclerkjk5dozber", "approximatecontrastow", "bountifultrombonistr", "analogousfoalcmtk7erivy", "quizzicalrubricun", "afiremopsvstkhcrqxcpyfm", "upperlakeshorexm1sdr2zak9"],
  gespraech: "Yoo buddy, i just follow you as im also a fellow streamer let's support each other... grind and maybe play games sometimes  let's conect and make it official on discord  add me  👉 [Discord]",
};

export const ZIELE = {
  n: {"spam_chatnachrichten": 550, "getroffene_kanaele": 155, "mit_zuschauerzahl": 496, "mit_session_treffer": 547, "chat_geloggte_kanaele_nenner": 545, "sekunden_je_snapshot": 34.3},
  zuschauerklasse: {
    spam_absolut: {"k0_5": 486, "k6_20": 9, "k21_50": 0, "k50p": 1},
    spam_unbekannt: 54,
    spam_anteil: {"k0_5": 0.98, "k6_20": 0.018, "k21_50": 0.0, "k50p": 0.002},
    streamstunden_anteil: {"k0_5": 0.761, "k6_20": 0.183, "k21_50": 0.03, "k50p": 0.026},
    streamstunden_stunden: {"k0_5": 27080.7, "k6_20": 6519.2, "k21_50": 1061.0, "k50p": 919.8},
  },
  streamstart: {"nenner_mit_session": 547, "in_ersten_10min": 12, "anteil_10min": 0.022, "in_ersten_30min": 101, "anteil_30min": 0.185},
  konzentration: {"verteilung": {"1_treffer": 73, "2_bis_4": 56, "5_bis_9": 12, "ab_10": 14}, "kanaele_gesamt": 155, "top10_anteil_der_spamnachrichten": 0.4, "top10_nachrichten": 220},
  partner: {"definition": "Partner = Kanal ist im Partnerprogramm twitch_partners.", "spam_absolut": {"partner": 286, "nichtpartner": 264}, "spam_anteil": {"partner": 0.52, "nichtpartner": 0.48}, "streamstunden_snapshots": {"partner": 1525211, "nichtpartner": 2207626}, "streamstunden_stunden": {"partner": 14538.0, "nichtpartner": 21042.7}, "streamstunden_anteil": {"partner": 0.409, "nichtpartner": 0.591}},
};

export const REAKTION_DETAIL = {
  reihe1: {"n_paare": 132, "median_s": 0.7, "p90_s": 1.3, "verteilung_absolut": {"unter_1s": 109, "1_bis_2s": 12, "2_bis_5s": 2, "ueber_5s": 9}, "verteilung_anteil": {"unter_1s": 0.826, "1_bis_2s": 0.091, "2_bis_5s": 0.015, "ueber_5s": 0.068}},
  reihe2: {"nenner_autoban_mit_content": 291, "n_paare": 177, "median_s": 0.4, "p90_s": 3.6, "verteilung_absolut": {"unter_1s": 156, "1_bis_2s": 0, "2_bis_5s": 6, "ueber_5s": 15}, "verteilung_anteil": {"unter_1s": 0.881, "1_bis_2s": 0.0, "2_bis_5s": 0.034, "ueber_5s": 0.085}},
};
export const TIMELINE = {
  chatbeginn: "2026-01-31",
  weeks: [{"key": "2026-W07", "label": "", "title": "Woche ab 9. Februar 2026"}, {"key": "2026-W08", "label": "", "title": "Woche ab 16. Februar 2026"}, {"key": "2026-W09", "label": "", "title": "Woche ab 23. Februar 2026"}, {"key": "2026-W10", "label": "Mär", "title": "Woche ab 2. März 2026"}, {"key": "2026-W11", "label": "", "title": "Woche ab 9. März 2026"}, {"key": "2026-W12", "label": "", "title": "Woche ab 16. März 2026"}, {"key": "2026-W13", "label": "", "title": "Woche ab 23. März 2026"}, {"key": "2026-W14", "label": "", "title": "Woche ab 30. März 2026"}, {"key": "2026-W15", "label": "Apr", "title": "Woche ab 6. April 2026"}, {"key": "2026-W16", "label": "", "title": "Woche ab 13. April 2026"}, {"key": "2026-W17", "label": "", "title": "Woche ab 20. April 2026"}, {"key": "2026-W18", "label": "", "title": "Woche ab 27. April 2026"}, {"key": "2026-W19", "label": "Mai", "title": "Woche ab 4. Mai 2026"}, {"key": "2026-W20", "label": "", "title": "Woche ab 11. Mai 2026"}, {"key": "2026-W21", "label": "", "title": "Woche ab 18. Mai 2026"}, {"key": "2026-W22", "label": "", "title": "Woche ab 25. Mai 2026"}, {"key": "2026-W23", "label": "Jun", "title": "Woche ab 1. Juni 2026"}, {"key": "2026-W24", "label": "", "title": "Woche ab 8. Juni 2026"}, {"key": "2026-W25", "label": "", "title": "Woche ab 15. Juni 2026"}, {"key": "2026-W26", "label": "", "title": "Woche ab 22. Juni 2026"}, {"key": "2026-W27", "label": "", "title": "Woche ab 29. Juni 2026"}, {"key": "2026-W28", "label": "Jul", "title": "Woche ab 6. Juli 2026"}, {"key": "2026-W29", "label": "", "title": "Woche ab 13. Juli 2026"}, {"key": "2026-W30", "label": "", "title": "Woche ab 20. Juli 2026"}, {"key": "2026-W31", "label": "", "title": "Woche ab 27. Juli 2026"}, {"key": "2026-W32", "label": "Aug", "title": "Woche ab 3. August 2026"}, {"key": "2026-W33", "label": "", "title": "Woche ab 10. August 2026"}, {"key": "2026-W34", "label": "", "title": "Woche ab 17. August 2026"}, {"key": "2026-W35", "label": "", "title": "Woche ab 24. August 2026"}, {"key": "2026-W36", "label": "", "title": "Woche ab 31. August 2026"}],
  marken: [
    {"name": "streamboo", "gesamt": 451, "kanaele": 132, "erst": "2026-02-12", "fragment": "2026-05-28", "wochen": {"2026-W07": 1, "2026-W08": 25, "2026-W11": 12, "2026-W12": 47, "2026-W13": 6, "2026-W16": 4, "2026-W20": 8, "2026-W21": 20, "2026-W22": 2, "2026-W29": 44, "2026-W30": 49, "2026-W31": 78, "2026-W32": 46, "2026-W33": 56, "2026-W34": 27, "2026-W35": 19, "2026-W36": 7}},
    {"name": "twitchmax", "gesamt": 52, "kanaele": 26, "erst": "2026-08-23", "fragment": "2026-08-23", "wochen": {"2026-W34": 3, "2026-W35": 38, "2026-W36": 11}},
    {"name": "promotion", "gesamt": 6, "kanaele": 5, "erst": "2026-07-13", "fragment": "2026-08-16", "wochen": {"2026-W29": 1, "2026-W33": 4, "2026-W34": 1}},
    {"name": "topxy", "gesamt": 6, "kanaele": 5, "erst": "2026-02-18", "fragment": null, "wochen": {"2026-W08": 6}},
    {"name": "twitchstar", "gesamt": 6, "kanaele": 5, "erst": "2026-08-22", "fragment": "2026-08-22", "wochen": {"2026-W34": 6}},
    {"name": "smmxl", "gesamt": 4, "kanaele": 1, "erst": "2026-02-20", "fragment": null, "wochen": {"2026-W08": 4}},
    {"name": "prmxy", "gesamt": 3, "kanaele": 3, "erst": "2026-02-20", "fragment": null, "wochen": {"2026-W08": 3}},
    {"name": "streamerbeat", "gesamt": 3, "kanaele": 2, "erst": "2026-08-30", "fragment": "2026-08-30", "wochen": {"2026-W35": 3}},
  ],
  sonstige: {"gesamt": 19, "marken": 13, "wochen": {"2026-W28": 2, "2026-W08": 7, "2026-W15": 4, "2026-W16": 2, "2026-W17": 1, "2026-W36": 2, "2026-W19": 1}},
  aktiv: [{"woche": "2026-W07", "aktiv": 1, "neu": 1}, {"woche": "2026-W08", "aktiv": 10, "neu": 9}, {"woche": "2026-W09", "aktiv": 0, "neu": 0}, {"woche": "2026-W10", "aktiv": 0, "neu": 0}, {"woche": "2026-W11", "aktiv": 1, "neu": 0}, {"woche": "2026-W12", "aktiv": 1, "neu": 0}, {"woche": "2026-W13", "aktiv": 1, "neu": 0}, {"woche": "2026-W14", "aktiv": 0, "neu": 0}, {"woche": "2026-W15", "aktiv": 2, "neu": 2}, {"woche": "2026-W16", "aktiv": 3, "neu": 2}, {"woche": "2026-W17", "aktiv": 1, "neu": 0}, {"woche": "2026-W18", "aktiv": 0, "neu": 0}, {"woche": "2026-W19", "aktiv": 1, "neu": 1}, {"woche": "2026-W20", "aktiv": 1, "neu": 0}, {"woche": "2026-W21", "aktiv": 1, "neu": 0}, {"woche": "2026-W22", "aktiv": 1, "neu": 0}, {"woche": "2026-W23", "aktiv": 0, "neu": 0}, {"woche": "2026-W24", "aktiv": 0, "neu": 0}, {"woche": "2026-W25", "aktiv": 0, "neu": 0}, {"woche": "2026-W26", "aktiv": 0, "neu": 0}, {"woche": "2026-W27", "aktiv": 0, "neu": 0}, {"woche": "2026-W28", "aktiv": 1, "neu": 1}, {"woche": "2026-W29", "aktiv": 2, "neu": 1}, {"woche": "2026-W30", "aktiv": 1, "neu": 0}, {"woche": "2026-W31", "aktiv": 1, "neu": 0}, {"woche": "2026-W32", "aktiv": 1, "neu": 0}, {"woche": "2026-W33", "aktiv": 2, "neu": 0}, {"woche": "2026-W34", "aktiv": 4, "neu": 2}, {"woche": "2026-W35", "aktiv": 3, "neu": 1}, {"woche": "2026-W36", "aktiv": 3, "neu": 1}],
};
