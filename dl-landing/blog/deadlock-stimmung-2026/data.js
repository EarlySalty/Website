// Erzeugt aus den Auswertungen in .tasks/2026-09-09-stimmung-blogpost/data/. Eine Quelle, kein Tippen.

export const STAND = '2026-09-09';

export const META = {
  "anlass_datum": "2026-09-09",
  "zeitraum_twitch": "2025-10 bis 2026-09",
  "zeitraum_discord": "2025-11 bis 2026-09",
  "scout_kanaele": 53,
  "chat_abdeckung_schnitt": null
};

export const KAP1 = {
  "steam": {
    "quelle": "dramalock.org, Fact-Check-Seite, Stand 2026-08-09; SteamDB-Monatstabelle zitiert per Pauzelock 2026-05-07",
    "allzeit_peak": {
      "wert": 171490,
      "datum": "2024-09-02"
    },
    "monatsschnitt_feb_2026": 71550,
    "schnitt_30_tage_bis_2026_05_07": 56468,
    "rueckgang_feb_bis_mai_prozent": 21.1,
    "snapshot_2026_08_09": {
      "im_spiel": 55386,
      "tagespeak": 82046
    },
    "peak_fruehjahr_2026_grob": 125000,
    "hinweis": "Steam liefert für Deadlock keine offene Spielerzahl per API (GetNumberOfCurrentPlayers antwortet 404, result 42). Zahlen sind Fremdquellen mit Datum."
  },
  "twitch": {
    "quelle": "Streams Charts, Kategorie Deadlock, 2026 bis Stichtag",
    "stunden_gesehen_2026": 51300000,
    "durchschnitt_zuschauer_2026": 8947,
    "peak_zuschauer_2026": 58914
  },
  "valve": {
    "wer": "Valve-Entwickler Yoshi im offiziellen Deadlock-Discord",
    "datum": "2026-08-28",
    "berichtet_von": [
      "deadlock.one 2026-08-28",
      "PCGamesN 2026-08-29"
    ],
    "kern": "Update hat länger gedauert als geplant, bester Schätzwert Ende September, Grund Playtesting und Iteration, kein kleinerer Umfang",
    "zitat": "The update has taken longer than we expected, we had hoped it would be released by now. The best estimate we can make right now is that it will be late September."
  },
  "patch": {
    "quelle": "dl-brain Patch-Historie (brain.patch_events)",
    "old_gods_new_blood": {
      "start": "2026-01-26",
      "ende": "2026-02-12",
      "helden": [
        "Rem",
        "Graves",
        "Silver",
        "Venator",
        "Celeste",
        "Apollo"
      ],
      "hinweis": "Sechs Helden in 18 Tagen, dazu Street Brawl und Patrons"
    },
    "gameplay_updates_2026": [
      "2026-03-06",
      "2026-04-30",
      "2026-05-22"
    ],
    "kleine_updates_seit_letztem_gameplay_update": [
      "2026-05-25",
      "2026-05-28",
      "2026-05-31",
      "2026-06-04",
      "2026-06-11",
      "2026-06-30",
      "2026-07-01",
      "2026-07-09",
      "2026-07-28",
      "2026-08-12",
      "2026-08-22"
    ],
    "tage_seit_letztem_gameplay_update_am_stichtag": 110,
    "tage_seit_apollo_am_stichtag": 209,
    "naechstes_grosses_update_erwartet": "Ende September 2026 (Valve-Schätzung, kein Datum)"
  }
};

export const PATCH_MARKER = [
  {
    "wk": "2026-07",
    "datum": "2026-02-12",
    "typ": "content",
    "name": "Old Gods, New Blood (Abschluss)"
  },
  {
    "wk": "2026-10",
    "datum": "2026-03-06",
    "typ": "gameplay",
    "name": "Gameplay-Update"
  },
  {
    "wk": "2026-18",
    "datum": "2026-04-30",
    "typ": "gameplay",
    "name": "Gameplay-Update"
  },
  {
    "wk": "2026-21",
    "datum": "2026-05-22",
    "typ": "gameplay",
    "name": "Gameplay-Update"
  },
  {
    "wk": "2026-24",
    "datum": "2026-06-11",
    "typ": "balance",
    "name": "Balance-Patch"
  },
  {
    "wk": "2026-27",
    "datum": "2026-06-30",
    "typ": "balance",
    "name": "Balance-Patch"
  },
  {
    "wk": "2026-28",
    "datum": "2026-07-09",
    "typ": "balance",
    "name": "Balance-Patch"
  },
  {
    "wk": "2026-31",
    "datum": "2026-07-28",
    "typ": "balance",
    "name": "Balance-Patch"
  },
  {
    "wk": "2026-33",
    "datum": "2026-08-12",
    "typ": "balance",
    "name": "Balance-Patch"
  },
  {
    "wk": "2026-34",
    "datum": "2026-08-22",
    "typ": "balance",
    "name": "Balance-Patch"
  }
];

export const PATCH_DELTA = {
  "old_gods": {
    "woche": "2026-07",
    "streamH": 353.5,
    "zuschauerH": 1263.2,
    "delta_stream": 32.6,
    "delta_zuschauer": 87,
    "plus2_stream": -32.8,
    "plus2_zuschauer": -58
  },
  "p0728": {
    "woche": "2026-31",
    "streamH": 322.8,
    "zuschauerH": 1707.1,
    "delta_stream": 68.6,
    "delta_zuschauer": 107.5
  }
};

export const SZENE = [
  {
    "wk": "2025-41",
    "partial": false,
    "streamH": 18,
    "zuschauerH": 70.4,
    "peak": 11,
    "chanDay": 3,
    "medStreams": 1,
    "chanWeek": 5
  },
  {
    "wk": "2025-42",
    "partial": false,
    "streamH": 68.7,
    "zuschauerH": 195.4,
    "peak": 18,
    "chanDay": 3,
    "medStreams": 1,
    "chanWeek": 9
  },
  {
    "wk": "2025-43",
    "partial": false,
    "streamH": 119.1,
    "zuschauerH": 566.1,
    "peak": 45,
    "chanDay": 5,
    "medStreams": 1,
    "chanWeek": 12
  },
  {
    "wk": "2025-44",
    "partial": false,
    "streamH": 77,
    "zuschauerH": 354.2,
    "peak": 43,
    "chanDay": 4,
    "medStreams": 1,
    "chanWeek": 10
  },
  {
    "wk": "2025-45",
    "partial": false,
    "streamH": 92.7,
    "zuschauerH": 224.8,
    "peak": 20,
    "chanDay": 3,
    "medStreams": 1,
    "chanWeek": 9
  },
  {
    "wk": "2025-46",
    "partial": false,
    "streamH": 92.3,
    "zuschauerH": 255.8,
    "peak": 28,
    "chanDay": 5,
    "medStreams": 1,
    "chanWeek": 11
  },
  {
    "wk": "2025-47",
    "partial": false,
    "streamH": 100.9,
    "zuschauerH": 303.2,
    "peak": 20,
    "chanDay": 3,
    "medStreams": 1,
    "chanWeek": 11
  },
  {
    "wk": "2025-48",
    "partial": false,
    "streamH": 112.8,
    "zuschauerH": 385.2,
    "peak": 34,
    "chanDay": 4,
    "medStreams": 1,
    "chanWeek": 11
  },
  {
    "wk": "2025-49",
    "partial": false,
    "streamH": 130.5,
    "zuschauerH": 634,
    "peak": 31,
    "chanDay": 4,
    "medStreams": 1,
    "chanWeek": 10
  },
  {
    "wk": "2025-50",
    "partial": false,
    "streamH": 131.5,
    "zuschauerH": 370.3,
    "peak": 28,
    "chanDay": 6,
    "medStreams": 2,
    "chanWeek": 13
  },
  {
    "wk": "2025-51",
    "partial": false,
    "streamH": 147.4,
    "zuschauerH": 323.6,
    "peak": 18,
    "chanDay": 7,
    "medStreams": 1,
    "chanWeek": 11
  },
  {
    "wk": "2025-52",
    "partial": false,
    "streamH": 123.1,
    "zuschauerH": 302,
    "peak": 33,
    "chanDay": 5,
    "medStreams": 1,
    "chanWeek": 9
  },
  {
    "wk": "2026-01",
    "partial": false,
    "streamH": 70,
    "zuschauerH": 166.8,
    "peak": 20,
    "chanDay": 5,
    "medStreams": 1,
    "chanWeek": 11
  },
  {
    "wk": "2026-02",
    "partial": false,
    "streamH": 82.4,
    "zuschauerH": 234,
    "peak": 29,
    "chanDay": 4,
    "medStreams": 1,
    "chanWeek": 8
  },
  {
    "wk": "2026-03",
    "partial": false,
    "streamH": 96.3,
    "zuschauerH": 270,
    "peak": 19,
    "chanDay": 4,
    "medStreams": 1,
    "chanWeek": 9
  },
  {
    "wk": "2026-04",
    "partial": false,
    "streamH": 154.5,
    "zuschauerH": 464.9,
    "peak": 44,
    "chanDay": 5,
    "medStreams": 2,
    "chanWeek": 16
  },
  {
    "wk": "2026-05",
    "partial": false,
    "streamH": 204.8,
    "zuschauerH": 556,
    "peak": 35,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 22
  },
  {
    "wk": "2026-06",
    "partial": false,
    "streamH": 266.5,
    "zuschauerH": 675.6,
    "peak": 32,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 22
  },
  {
    "wk": "2026-07",
    "partial": false,
    "streamH": 353.5,
    "zuschauerH": 1263.2,
    "peak": 40,
    "chanDay": 14,
    "medStreams": 2,
    "chanWeek": 27
  },
  {
    "wk": "2026-08",
    "partial": false,
    "streamH": 329.7,
    "zuschauerH": 853.1,
    "peak": 42,
    "chanDay": 17,
    "medStreams": 3,
    "chanWeek": 30
  },
  {
    "wk": "2026-09",
    "partial": false,
    "streamH": 237.7,
    "zuschauerH": 530.8,
    "peak": 29,
    "chanDay": 14,
    "medStreams": 2,
    "chanWeek": 27
  },
  {
    "wk": "2026-10",
    "partial": false,
    "streamH": 314.8,
    "zuschauerH": 792.5,
    "peak": 57,
    "chanDay": 14,
    "medStreams": 2,
    "chanWeek": 29
  },
  {
    "wk": "2026-11",
    "partial": false,
    "streamH": 173.2,
    "zuschauerH": 404.2,
    "peak": 29,
    "chanDay": 13,
    "medStreams": 2,
    "chanWeek": 25
  },
  {
    "wk": "2026-12",
    "partial": false,
    "streamH": 268.3,
    "zuschauerH": 690.6,
    "peak": 37,
    "chanDay": 11,
    "medStreams": 2,
    "chanWeek": 23
  },
  {
    "wk": "2026-13",
    "partial": false,
    "streamH": 197.7,
    "zuschauerH": 641.8,
    "peak": 44,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 24
  },
  {
    "wk": "2026-14",
    "partial": false,
    "streamH": 206.6,
    "zuschauerH": 621.3,
    "peak": 39,
    "chanDay": 9,
    "medStreams": 2,
    "chanWeek": 22
  },
  {
    "wk": "2026-15",
    "partial": false,
    "streamH": 296.4,
    "zuschauerH": 976.6,
    "peak": 42,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 25
  },
  {
    "wk": "2026-16",
    "partial": false,
    "streamH": 309.1,
    "zuschauerH": 1138.1,
    "peak": 30,
    "chanDay": 11,
    "medStreams": 2,
    "chanWeek": 24
  },
  {
    "wk": "2026-17",
    "partial": false,
    "streamH": 258.8,
    "zuschauerH": 835.1,
    "peak": 85,
    "chanDay": 12,
    "medStreams": 3,
    "chanWeek": 20
  },
  {
    "wk": "2026-18",
    "partial": false,
    "streamH": 203.9,
    "zuschauerH": 512.4,
    "peak": 23,
    "chanDay": 11,
    "medStreams": 2,
    "chanWeek": 21
  },
  {
    "wk": "2026-19",
    "partial": false,
    "streamH": 296.8,
    "zuschauerH": 1531.2,
    "peak": 120,
    "chanDay": 12,
    "medStreams": 2,
    "chanWeek": 26
  },
  {
    "wk": "2026-20",
    "partial": false,
    "streamH": 278,
    "zuschauerH": 1308.4,
    "peak": 95,
    "chanDay": 13,
    "medStreams": 2,
    "chanWeek": 25
  },
  {
    "wk": "2026-21",
    "partial": false,
    "streamH": 181,
    "zuschauerH": 1264.3,
    "peak": 105,
    "chanDay": 8,
    "medStreams": 2,
    "chanWeek": 22
  },
  {
    "wk": "2026-22",
    "partial": false,
    "streamH": 214.4,
    "zuschauerH": 742.3,
    "peak": 110,
    "chanDay": 11,
    "medStreams": 2,
    "chanWeek": 23
  },
  {
    "wk": "2026-23",
    "partial": false,
    "streamH": 331.5,
    "zuschauerH": 1036.3,
    "peak": 93,
    "chanDay": 12,
    "medStreams": 3,
    "chanWeek": 26
  },
  {
    "wk": "2026-24",
    "partial": false,
    "streamH": 280.3,
    "zuschauerH": 982.9,
    "peak": 81,
    "chanDay": 12,
    "medStreams": 2,
    "chanWeek": 27
  },
  {
    "wk": "2026-25",
    "partial": false,
    "streamH": 192.4,
    "zuschauerH": 733.5,
    "peak": 107,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 22
  },
  {
    "wk": "2026-26",
    "partial": false,
    "streamH": 221.4,
    "zuschauerH": 839.4,
    "peak": 113,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 20
  },
  {
    "wk": "2026-27",
    "partial": false,
    "streamH": 213.7,
    "zuschauerH": 614.9,
    "peak": 101,
    "chanDay": 9,
    "medStreams": 2,
    "chanWeek": 23
  },
  {
    "wk": "2026-28",
    "partial": false,
    "streamH": 179.9,
    "zuschauerH": 702.7,
    "peak": 48,
    "chanDay": 7,
    "medStreams": 2,
    "chanWeek": 20
  },
  {
    "wk": "2026-29",
    "partial": false,
    "streamH": 218.8,
    "zuschauerH": 865.6,
    "peak": 56,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 23
  },
  {
    "wk": "2026-30",
    "partial": false,
    "streamH": 191.5,
    "zuschauerH": 822.7,
    "peak": 50,
    "chanDay": 8,
    "medStreams": 2,
    "chanWeek": 19
  },
  {
    "wk": "2026-31",
    "partial": false,
    "streamH": 322.8,
    "zuschauerH": 1707.1,
    "peak": 76,
    "chanDay": 12,
    "medStreams": 3,
    "chanWeek": 26
  },
  {
    "wk": "2026-32",
    "partial": false,
    "streamH": 198.2,
    "zuschauerH": 870.7,
    "peak": 48,
    "chanDay": 9,
    "medStreams": 2,
    "chanWeek": 20
  },
  {
    "wk": "2026-33",
    "partial": false,
    "streamH": 301.7,
    "zuschauerH": 1485.2,
    "peak": 109,
    "chanDay": 14,
    "medStreams": 2,
    "chanWeek": 29
  },
  {
    "wk": "2026-34",
    "partial": false,
    "streamH": 311.1,
    "zuschauerH": 1393.8,
    "peak": 63,
    "chanDay": 12,
    "medStreams": 2,
    "chanWeek": 24
  },
  {
    "wk": "2026-35",
    "partial": false,
    "streamH": 236.1,
    "zuschauerH": 1068,
    "peak": 56,
    "chanDay": 10,
    "medStreams": 2,
    "chanWeek": 20
  },
  {
    "wk": "2026-36",
    "partial": false,
    "streamH": 239.8,
    "zuschauerH": 1655.1,
    "peak": 55,
    "chanDay": 11,
    "medStreams": 2,
    "chanWeek": 23
  },
  {
    "wk": "2026-37",
    "partial": true,
    "streamH": 104.5,
    "zuschauerH": 692.3,
    "peak": 48,
    "chanDay": 14,
    "medStreams": 2,
    "chanWeek": 21
  }
];

export const ABSCHNITTE = {
  "herbst2025": {
    "von": "2025-41",
    "bis": "2025-52",
    "streamH": 101.2
  },
  "fruehjahr": {
    "von": "2026-15",
    "bis": "2026-26",
    "streamH": 255.3,
    "peak": 83.7
  },
  "spaetsommer": {
    "von": "2026-31",
    "bis": "2026-36",
    "streamH": 268.3,
    "peak": 67.8
  },
  "peak_rueckgang_pct": 19,
  "allzeit_peak": {
    "wert": 120,
    "wk": "2026-19"
  }
};

export const CHAT = [
  {
    "wk": "2026-05",
    "partial": false,
    "msgs": 8,
    "chatters": 1,
    "labeled": 8,
    "hype": 0,
    "feedback": 0,
    "question": 1,
    "game": 1,
    "social": 0,
    "reaction": 1,
    "kw_totdead": 0,
    "kw_patch": 0,
    "kw_wann": 0,
    "kw_langw": 0,
    "kw_held": 0,
    "kw_valve": 0,
    "kw_hype": 0,
    "sessWithMsg": 1,
    "hoursWithMsg": 5.9,
    "dlSessions": 6,
    "firstTimeStreamer": 0
  },
  {
    "wk": "2026-06",
    "partial": false,
    "msgs": 1950,
    "chatters": 67,
    "labeled": 1950,
    "hype": 36,
    "feedback": 26,
    "question": 182,
    "game": 61,
    "social": 76,
    "reaction": 347,
    "kw_totdead": 0,
    "kw_patch": 0,
    "kw_wann": 0,
    "kw_langw": 0,
    "kw_held": 0,
    "kw_valve": 0,
    "kw_hype": 0,
    "sessWithMsg": 31,
    "hoursWithMsg": 130.7,
    "dlSessions": 59,
    "firstTimeStreamer": 73
  },
  {
    "wk": "2026-07",
    "partial": false,
    "msgs": 2943,
    "chatters": 95,
    "labeled": 2943,
    "hype": 91,
    "feedback": 32,
    "question": 383,
    "game": 270,
    "social": 164,
    "reaction": 614,
    "kw_totdead": 7,
    "kw_patch": 2,
    "kw_wann": 5,
    "kw_langw": 0,
    "kw_held": 2,
    "kw_valve": 16,
    "kw_hype": 20,
    "sessWithMsg": 26,
    "hoursWithMsg": 136.5,
    "dlSessions": 75,
    "firstTimeStreamer": 91
  },
  {
    "wk": "2026-08",
    "partial": false,
    "msgs": 23200,
    "chatters": 1827,
    "labeled": 23200,
    "hype": 883,
    "feedback": 405,
    "question": 2704,
    "game": 1956,
    "social": 1532,
    "reaction": 4573,
    "kw_totdead": 78,
    "kw_patch": 35,
    "kw_wann": 26,
    "kw_langw": 10,
    "kw_held": 39,
    "kw_valve": 48,
    "kw_hype": 341,
    "sessWithMsg": 308,
    "hoursWithMsg": 4898.5,
    "dlSessions": 549,
    "firstTimeStreamer": 2050
  },
  {
    "wk": "2026-09",
    "partial": false,
    "msgs": 63,
    "chatters": 5,
    "labeled": 63,
    "hype": 3,
    "feedback": 2,
    "question": 8,
    "game": 20,
    "social": 1,
    "reaction": 10,
    "kw_totdead": 0,
    "kw_patch": 0,
    "kw_wann": 0,
    "kw_langw": 0,
    "kw_held": 0,
    "kw_valve": 0,
    "kw_hype": 6,
    "sessWithMsg": 1,
    "hoursWithMsg": 69.8,
    "dlSessions": 414,
    "firstTimeStreamer": 119
  },
  {
    "wk": "2026-10",
    "partial": false,
    "msgs": 0,
    "chatters": null,
    "labeled": null,
    "hype": null,
    "feedback": null,
    "question": null,
    "game": null,
    "social": null,
    "reaction": null,
    "kw_totdead": null,
    "kw_patch": null,
    "kw_wann": null,
    "kw_langw": null,
    "kw_held": null,
    "kw_valve": null,
    "kw_hype": null,
    "sessWithMsg": 0,
    "hoursWithMsg": null,
    "dlSessions": 718,
    "firstTimeStreamer": 202
  },
  {
    "wk": "2026-11",
    "partial": false,
    "msgs": 4583,
    "chatters": 491,
    "labeled": 4583,
    "hype": 107,
    "feedback": 54,
    "question": 517,
    "game": 262,
    "social": 249,
    "reaction": 831,
    "kw_totdead": 9,
    "kw_patch": 3,
    "kw_wann": 9,
    "kw_langw": 1,
    "kw_held": 7,
    "kw_valve": 12,
    "kw_hype": 55,
    "sessWithMsg": 75,
    "hoursWithMsg": 372.5,
    "dlSessions": 488,
    "firstTimeStreamer": 660
  },
  {
    "wk": "2026-12",
    "partial": false,
    "msgs": 20840,
    "chatters": 1215,
    "labeled": 20840,
    "hype": 815,
    "feedback": 344,
    "question": 2449,
    "game": 1772,
    "social": 1294,
    "reaction": 4156,
    "kw_totdead": 65,
    "kw_patch": 33,
    "kw_wann": 38,
    "kw_langw": 9,
    "kw_held": 19,
    "kw_valve": 21,
    "kw_hype": 252,
    "sessWithMsg": 293,
    "hoursWithMsg": 1120.9,
    "dlSessions": 484,
    "firstTimeStreamer": 1359
  },
  {
    "wk": "2026-13",
    "partial": false,
    "msgs": 5214,
    "chatters": 353,
    "labeled": 5214,
    "hype": 188,
    "feedback": 112,
    "question": 567,
    "game": 493,
    "social": 382,
    "reaction": 1048,
    "kw_totdead": 16,
    "kw_patch": 15,
    "kw_wann": 3,
    "kw_langw": 2,
    "kw_held": 2,
    "kw_valve": 7,
    "kw_hype": 81,
    "sessWithMsg": 76,
    "hoursWithMsg": 254.2,
    "dlSessions": 475,
    "firstTimeStreamer": 386
  },
  {
    "wk": "2026-14",
    "partial": false,
    "msgs": 1596,
    "chatters": 81,
    "labeled": 1596,
    "hype": 86,
    "feedback": 39,
    "question": 188,
    "game": 166,
    "social": 75,
    "reaction": 322,
    "kw_totdead": 12,
    "kw_patch": 1,
    "kw_wann": 2,
    "kw_langw": 2,
    "kw_held": 2,
    "kw_valve": 1,
    "kw_hype": 21,
    "sessWithMsg": 39,
    "hoursWithMsg": 127.7,
    "dlSessions": 362,
    "firstTimeStreamer": 181
  },
  {
    "wk": "2026-15",
    "partial": false,
    "msgs": 1653,
    "chatters": 102,
    "labeled": 1653,
    "hype": 72,
    "feedback": 34,
    "question": 224,
    "game": 200,
    "social": 47,
    "reaction": 262,
    "kw_totdead": 4,
    "kw_patch": 7,
    "kw_wann": 3,
    "kw_langw": 0,
    "kw_held": 1,
    "kw_valve": 1,
    "kw_hype": 18,
    "sessWithMsg": 49,
    "hoursWithMsg": 213.9,
    "dlSessions": 336,
    "firstTimeStreamer": 270
  },
  {
    "wk": "2026-16",
    "partial": false,
    "msgs": 2036,
    "chatters": 105,
    "labeled": 2036,
    "hype": 64,
    "feedback": 39,
    "question": 247,
    "game": 210,
    "social": 105,
    "reaction": 428,
    "kw_totdead": 7,
    "kw_patch": 7,
    "kw_wann": 2,
    "kw_langw": 0,
    "kw_held": 4,
    "kw_valve": 2,
    "kw_hype": 21,
    "sessWithMsg": 45,
    "hoursWithMsg": 187.7,
    "dlSessions": 302,
    "firstTimeStreamer": 252
  },
  {
    "wk": "2026-17",
    "partial": false,
    "msgs": 796,
    "chatters": 69,
    "labeled": 796,
    "hype": 26,
    "feedback": 17,
    "question": 96,
    "game": 87,
    "social": 25,
    "reaction": 135,
    "kw_totdead": 2,
    "kw_patch": 2,
    "kw_wann": 0,
    "kw_langw": 1,
    "kw_held": 0,
    "kw_valve": 0,
    "kw_hype": 8,
    "sessWithMsg": 30,
    "hoursWithMsg": 122.5,
    "dlSessions": 345,
    "firstTimeStreamer": 185
  },
  {
    "wk": "2026-18",
    "partial": false,
    "msgs": 768,
    "chatters": 53,
    "labeled": 768,
    "hype": 22,
    "feedback": 21,
    "question": 92,
    "game": 53,
    "social": 24,
    "reaction": 151,
    "kw_totdead": 1,
    "kw_patch": 2,
    "kw_wann": 0,
    "kw_langw": 0,
    "kw_held": 2,
    "kw_valve": 1,
    "kw_hype": 6,
    "sessWithMsg": 34,
    "hoursWithMsg": 140,
    "dlSessions": 266,
    "firstTimeStreamer": 138
  },
  {
    "wk": "2026-19",
    "partial": false,
    "msgs": 1305,
    "chatters": 88,
    "labeled": 1305,
    "hype": 60,
    "feedback": 31,
    "question": 159,
    "game": 205,
    "social": 60,
    "reaction": 207,
    "kw_totdead": 10,
    "kw_patch": 5,
    "kw_wann": 6,
    "kw_langw": 1,
    "kw_held": 1,
    "kw_valve": 4,
    "kw_hype": 20,
    "sessWithMsg": 37,
    "hoursWithMsg": 162.2,
    "dlSessions": 291,
    "firstTimeStreamer": 193
  },
  {
    "wk": "2026-20",
    "partial": false,
    "msgs": 995,
    "chatters": 49,
    "labeled": 995,
    "hype": 43,
    "feedback": 19,
    "question": 88,
    "game": 100,
    "social": 31,
    "reaction": 157,
    "kw_totdead": 6,
    "kw_patch": 2,
    "kw_wann": 0,
    "kw_langw": 2,
    "kw_held": 1,
    "kw_valve": 1,
    "kw_hype": 19,
    "sessWithMsg": 15,
    "hoursWithMsg": 57.8,
    "dlSessions": 299,
    "firstTimeStreamer": 243
  },
  {
    "wk": "2026-21",
    "partial": false,
    "msgs": 1405,
    "chatters": 79,
    "labeled": 1405,
    "hype": 67,
    "feedback": 34,
    "question": 122,
    "game": 244,
    "social": 43,
    "reaction": 284,
    "kw_totdead": 3,
    "kw_patch": 12,
    "kw_wann": 2,
    "kw_langw": 1,
    "kw_held": 0,
    "kw_valve": 2,
    "kw_hype": 17,
    "sessWithMsg": 38,
    "hoursWithMsg": 132.3,
    "dlSessions": 243,
    "firstTimeStreamer": 182
  },
  {
    "wk": "2026-22",
    "partial": false,
    "msgs": 2420,
    "chatters": 77,
    "labeled": 2420,
    "hype": 81,
    "feedback": 54,
    "question": 230,
    "game": 374,
    "social": 80,
    "reaction": 415,
    "kw_totdead": 10,
    "kw_patch": 16,
    "kw_wann": 1,
    "kw_langw": 0,
    "kw_held": 6,
    "kw_valve": 3,
    "kw_hype": 22,
    "sessWithMsg": 35,
    "hoursWithMsg": 128.8,
    "dlSessions": 262,
    "firstTimeStreamer": 145
  },
  {
    "wk": "2026-23",
    "partial": false,
    "msgs": 3606,
    "chatters": 116,
    "labeled": 3606,
    "hype": 134,
    "feedback": 105,
    "question": 419,
    "game": 471,
    "social": 155,
    "reaction": 575,
    "kw_totdead": 8,
    "kw_patch": 7,
    "kw_wann": 1,
    "kw_langw": 4,
    "kw_held": 3,
    "kw_valve": 11,
    "kw_hype": 53,
    "sessWithMsg": 62,
    "hoursWithMsg": 238.3,
    "dlSessions": 250,
    "firstTimeStreamer": 318
  },
  {
    "wk": "2026-24",
    "partial": false,
    "msgs": 2774,
    "chatters": 114,
    "labeled": 2774,
    "hype": 89,
    "feedback": 78,
    "question": 356,
    "game": 366,
    "social": 93,
    "reaction": 491,
    "kw_totdead": 16,
    "kw_patch": 19,
    "kw_wann": 4,
    "kw_langw": 0,
    "kw_held": 4,
    "kw_valve": 3,
    "kw_hype": 33,
    "sessWithMsg": 55,
    "hoursWithMsg": 205.2,
    "dlSessions": 228,
    "firstTimeStreamer": 198
  },
  {
    "wk": "2026-25",
    "partial": false,
    "msgs": 761,
    "chatters": 59,
    "labeled": 761,
    "hype": 35,
    "feedback": 25,
    "question": 75,
    "game": 117,
    "social": 28,
    "reaction": 96,
    "kw_totdead": 5,
    "kw_patch": 0,
    "kw_wann": 4,
    "kw_langw": 1,
    "kw_held": 0,
    "kw_valve": 1,
    "kw_hype": 15,
    "sessWithMsg": 10,
    "hoursWithMsg": 299.9,
    "dlSessions": 33,
    "firstTimeStreamer": 37
  },
  {
    "wk": "2026-26",
    "partial": false,
    "msgs": 3484,
    "chatters": 106,
    "labeled": 3484,
    "hype": 89,
    "feedback": 73,
    "question": 332,
    "game": 493,
    "social": 105,
    "reaction": 520,
    "kw_totdead": 18,
    "kw_patch": 5,
    "kw_wann": 7,
    "kw_langw": 3,
    "kw_held": 9,
    "kw_valve": 1,
    "kw_hype": 43,
    "sessWithMsg": 42,
    "hoursWithMsg": 182.9,
    "dlSessions": 156,
    "firstTimeStreamer": 208
  },
  {
    "wk": "2026-27",
    "partial": false,
    "msgs": 2654,
    "chatters": 105,
    "labeled": 2654,
    "hype": 88,
    "feedback": 70,
    "question": 240,
    "game": 374,
    "social": 84,
    "reaction": 419,
    "kw_totdead": 7,
    "kw_patch": 13,
    "kw_wann": 8,
    "kw_langw": 2,
    "kw_held": 3,
    "kw_valve": 6,
    "kw_hype": 20,
    "sessWithMsg": 44,
    "hoursWithMsg": 181.2,
    "dlSessions": 195,
    "firstTimeStreamer": 228
  },
  {
    "wk": "2026-28",
    "partial": false,
    "msgs": 3975,
    "chatters": 106,
    "labeled": 3975,
    "hype": 120,
    "feedback": 103,
    "question": 367,
    "game": 534,
    "social": 172,
    "reaction": 638,
    "kw_totdead": 7,
    "kw_patch": 21,
    "kw_wann": 3,
    "kw_langw": 2,
    "kw_held": 5,
    "kw_valve": 9,
    "kw_hype": 39,
    "sessWithMsg": 49,
    "hoursWithMsg": 194.2,
    "dlSessions": 186,
    "firstTimeStreamer": 248
  },
  {
    "wk": "2026-29",
    "partial": false,
    "msgs": 8318,
    "chatters": 284,
    "labeled": 8318,
    "hype": 304,
    "feedback": 205,
    "question": 824,
    "game": 1243,
    "social": 329,
    "reaction": 1470,
    "kw_totdead": 44,
    "kw_patch": 23,
    "kw_wann": 11,
    "kw_langw": 2,
    "kw_held": 8,
    "kw_valve": 23,
    "kw_hype": 98,
    "sessWithMsg": 116,
    "hoursWithMsg": 386.6,
    "dlSessions": 207,
    "firstTimeStreamer": 509
  },
  {
    "wk": "2026-30",
    "partial": false,
    "msgs": 6700,
    "chatters": 351,
    "labeled": 6700,
    "hype": 211,
    "feedback": 176,
    "question": 631,
    "game": 1093,
    "social": 178,
    "reaction": 977,
    "kw_totdead": 32,
    "kw_patch": 28,
    "kw_wann": 11,
    "kw_langw": 4,
    "kw_held": 25,
    "kw_valve": 11,
    "kw_hype": 61,
    "sessWithMsg": 131,
    "hoursWithMsg": 442.7,
    "dlSessions": 184,
    "firstTimeStreamer": 398
  },
  {
    "wk": "2026-31",
    "partial": false,
    "msgs": 15781,
    "chatters": 925,
    "labeled": 15781,
    "hype": 694,
    "feedback": 362,
    "question": 1814,
    "game": 2278,
    "social": 679,
    "reaction": 2600,
    "kw_totdead": 52,
    "kw_patch": 90,
    "kw_wann": 23,
    "kw_langw": 12,
    "kw_held": 43,
    "kw_valve": 23,
    "kw_hype": 241,
    "sessWithMsg": 196,
    "hoursWithMsg": 782.7,
    "dlSessions": 283,
    "firstTimeStreamer": 1441
  },
  {
    "wk": "2026-32",
    "partial": false,
    "msgs": 11457,
    "chatters": 559,
    "labeled": 11457,
    "hype": 443,
    "feedback": 235,
    "question": 1224,
    "game": 1688,
    "social": 511,
    "reaction": 2180,
    "kw_totdead": 37,
    "kw_patch": 35,
    "kw_wann": 18,
    "kw_langw": 3,
    "kw_held": 36,
    "kw_valve": 21,
    "kw_hype": 152,
    "sessWithMsg": 169,
    "hoursWithMsg": 628,
    "dlSessions": 279,
    "firstTimeStreamer": 764
  },
  {
    "wk": "2026-33",
    "partial": false,
    "msgs": 16208,
    "chatters": 582,
    "labeled": 16208,
    "hype": 565,
    "feedback": 364,
    "question": 1609,
    "game": 2745,
    "social": 551,
    "reaction": 2961,
    "kw_totdead": 65,
    "kw_patch": 59,
    "kw_wann": 38,
    "kw_langw": 9,
    "kw_held": 41,
    "kw_valve": 24,
    "kw_hype": 144,
    "sessWithMsg": 228,
    "hoursWithMsg": 843.8,
    "dlSessions": 337,
    "firstTimeStreamer": 805
  },
  {
    "wk": "2026-34",
    "partial": false,
    "msgs": 14020,
    "chatters": 655,
    "labeled": 14020,
    "hype": 514,
    "feedback": 316,
    "question": 1481,
    "game": 1520,
    "social": 791,
    "reaction": 2617,
    "kw_totdead": 37,
    "kw_patch": 25,
    "kw_wann": 44,
    "kw_langw": 12,
    "kw_held": 27,
    "kw_valve": 21,
    "kw_hype": 151,
    "sessWithMsg": 203,
    "hoursWithMsg": 749.4,
    "dlSessions": 331,
    "firstTimeStreamer": 988
  },
  {
    "wk": "2026-35",
    "partial": false,
    "msgs": 9229,
    "chatters": 437,
    "labeled": 9229,
    "hype": 342,
    "feedback": 177,
    "question": 949,
    "game": 978,
    "social": 522,
    "reaction": 1662,
    "kw_totdead": 29,
    "kw_patch": 42,
    "kw_wann": 7,
    "kw_langw": 6,
    "kw_held": 16,
    "kw_valve": 16,
    "kw_hype": 104,
    "sessWithMsg": 163,
    "hoursWithMsg": 559.9,
    "dlSessions": 277,
    "firstTimeStreamer": 578
  },
  {
    "wk": "2026-36",
    "partial": false,
    "msgs": 15932,
    "chatters": 571,
    "labeled": 15932,
    "hype": 553,
    "feedback": 441,
    "question": 1781,
    "game": 1744,
    "social": 833,
    "reaction": 3053,
    "kw_totdead": 48,
    "kw_patch": 43,
    "kw_wann": 23,
    "kw_langw": 10,
    "kw_held": 25,
    "kw_valve": 24,
    "kw_hype": 181,
    "sessWithMsg": 197,
    "hoursWithMsg": 755.6,
    "dlSessions": 282,
    "firstTimeStreamer": 815
  },
  {
    "wk": "2026-37",
    "partial": true,
    "msgs": 8219,
    "chatters": 272,
    "labeled": 8086,
    "hype": 306,
    "feedback": 157,
    "question": 737,
    "game": 797,
    "social": 411,
    "reaction": 1693,
    "kw_totdead": 11,
    "kw_patch": 23,
    "kw_wann": 13,
    "kw_langw": 5,
    "kw_held": 26,
    "kw_valve": 5,
    "kw_hype": 87,
    "sessWithMsg": 80,
    "hoursWithMsg": 245.1,
    "dlSessions": 107,
    "firstTimeStreamer": 369
  }
];

export const TOTDEAD = {
  "stichprobe": 50,
  "spiel": 4,
  "spielertod": 24,
  "anderes": 22
};

export const CHAT_BEISPIELE = {
  "twitch_totdead": [
    "arena is so tot xD",
    "alle nur ranked zocken und die Que dead ist",
    "jede runde war komplett tot",
    "diese invulnerability ist tot",
    "ist aber echt noch tot leise"
  ],
  "twitch_patch": [
    "jeden patch wird pocket generft aber doorman und lash duerfen so bleiben",
    "Yoshi Patch kommt nie",
    "bald dann aber endlich dicker content patch surely",
    "sobald der grosse major patch kommt dann laeufts wieder",
    "is eh alles egal wenn neuer patch kommt sag ich"
  ]
};

export const NEWCOMERS = {
  "summe": 14633,
  "max": 2050,
  "maxWk": "2026-08",
  "confirmed_first_ever": 0,
  "confirmed_rows": 88490
};

export const VOICE = [
  {
    "wk": "2025-48",
    "hours": 391.6,
    "users": 53
  },
  {
    "wk": "2025-49",
    "hours": 491,
    "users": 59
  },
  {
    "wk": "2025-50",
    "hours": 446.3,
    "users": 54
  },
  {
    "wk": "2025-51",
    "hours": 565,
    "users": 63
  },
  {
    "wk": "2025-52",
    "hours": 567.1,
    "users": 50
  },
  {
    "wk": "2026-01",
    "hours": 706.3,
    "users": 52
  },
  {
    "wk": "2026-02",
    "hours": 449.5,
    "users": 50
  },
  {
    "wk": "2026-03",
    "hours": 355.8,
    "users": 54
  },
  {
    "wk": "2026-04",
    "hours": 384.4,
    "users": 67
  },
  {
    "wk": "2026-05",
    "hours": 644.9,
    "users": 92
  },
  {
    "wk": "2026-06",
    "hours": 736.6,
    "users": 100
  },
  {
    "wk": "2026-07",
    "hours": 946.9,
    "users": 108
  },
  {
    "wk": "2026-08",
    "hours": 971.7,
    "users": 148
  },
  {
    "wk": "2026-09",
    "hours": 1026.9,
    "users": 143
  },
  {
    "wk": "2026-10",
    "hours": 946.4,
    "users": 129
  },
  {
    "wk": "2026-11",
    "hours": 1195.8,
    "users": 140
  },
  {
    "wk": "2026-12",
    "hours": 1205.1,
    "users": 153
  },
  {
    "wk": "2026-13",
    "hours": 1273.7,
    "users": 148
  },
  {
    "wk": "2026-14",
    "hours": 1264.2,
    "users": 164
  },
  {
    "wk": "2026-15",
    "hours": 1241.4,
    "users": 160
  },
  {
    "wk": "2026-16",
    "hours": 1047.5,
    "users": 147
  },
  {
    "wk": "2026-17",
    "hours": 957.5,
    "users": 122
  },
  {
    "wk": "2026-18",
    "hours": 1129.2,
    "users": 135
  },
  {
    "wk": "2026-19",
    "hours": 1023.1,
    "users": 138
  },
  {
    "wk": "2026-20",
    "hours": 1063.4,
    "users": 121
  },
  {
    "wk": "2026-21",
    "hours": 866.5,
    "users": 110
  },
  {
    "wk": "2026-22",
    "hours": 704.4,
    "users": 105
  },
  {
    "wk": "2026-23",
    "hours": 961.7,
    "users": 110
  },
  {
    "wk": "2026-24",
    "hours": 532.4,
    "users": 111
  },
  {
    "wk": "2026-25",
    "hours": 854.1,
    "users": 121
  },
  {
    "wk": "2026-26",
    "hours": 899.6,
    "users": 103
  },
  {
    "wk": "2026-27",
    "hours": 881.9,
    "users": 117
  },
  {
    "wk": "2026-28",
    "hours": 744.6,
    "users": 92
  },
  {
    "wk": "2026-29",
    "hours": 1041.8,
    "users": 122
  },
  {
    "wk": "2026-30",
    "hours": 896.2,
    "users": 105
  },
  {
    "wk": "2026-31",
    "hours": 1114.7,
    "users": 124
  },
  {
    "wk": "2026-32",
    "hours": 1273,
    "users": 123
  },
  {
    "wk": "2026-33",
    "hours": 1207.9,
    "users": 128
  },
  {
    "wk": "2026-34",
    "hours": 1096.5,
    "users": 101
  },
  {
    "wk": "2026-35",
    "hours": 901.5,
    "users": 106
  },
  {
    "wk": "2026-36",
    "hours": 1105.3,
    "users": 121
  }
];

export const VOICE_MONAT = [
  {
    "monat": "2025-11",
    "stunden": 392,
    "users": 53,
    "sessionsRoh": 611,
    "sessionsGe60s": 445
  },
  {
    "monat": "2025-12",
    "stunden": 2338,
    "users": 107,
    "sessionsRoh": 3063,
    "sessionsGe60s": 1995
  },
  {
    "monat": "2026-01",
    "stunden": 2137,
    "users": 134,
    "sessionsRoh": 3612,
    "sessionsGe60s": 2399
  },
  {
    "monat": "2026-02",
    "stunden": 3678,
    "users": 276,
    "sessionsRoh": 10666,
    "sessionsGe60s": 4872
  },
  {
    "monat": "2026-03",
    "stunden": 5113,
    "users": 313,
    "sessionsRoh": 12099,
    "sessionsGe60s": 5682
  },
  {
    "monat": "2026-04",
    "stunden": 4723,
    "users": 305,
    "sessionsRoh": 13648,
    "sessionsGe60s": 5283
  },
  {
    "monat": "2026-05",
    "stunden": 4222,
    "users": 246,
    "sessionsRoh": 14325,
    "sessionsGe60s": 4779
  },
  {
    "monat": "2026-06",
    "stunden": 3403,
    "users": 210,
    "sessionsRoh": 6094,
    "sessionsGe60s": 3812
  },
  {
    "monat": "2026-07",
    "stunden": 4064,
    "users": 217,
    "sessionsRoh": 6497,
    "sessionsGe60s": 4839
  },
  {
    "monat": "2026-08",
    "stunden": 5060,
    "users": 241,
    "sessionsRoh": 8690,
    "sessionsGe60s": 5624
  },
  {
    "monat": "2026-09",
    "stunden": 1251,
    "users": 126,
    "sessionsRoh": 2388,
    "sessionsGe60s": 1347
  }
];

export const TAGESZEIT = {
  "spring": {
    "von": "2026-03",
    "bis": "2026-05",
    "share16_22": 41.5
  },
  "summer": {
    "von": "2026-07",
    "bis": "2026-09",
    "share16_22": 50,
    "matrix": [
      [
        5.2,
        4,
        3.5,
        2.7,
        2.1,
        1.2,
        0.3,
        0.3,
        0.4,
        0.5,
        1.1,
        2,
        3.4,
        4.8,
        7.9,
        8.6,
        8.9,
        12.5,
        12.8,
        12.1,
        11,
        13.1,
        11.3,
        8.5
      ],
      [
        7.3,
        5.3,
        3.6,
        2.9,
        1,
        0.2,
        0,
        0,
        0,
        0.4,
        1,
        1.6,
        1.9,
        3.1,
        3.7,
        5.1,
        7.5,
        8.6,
        8.7,
        9.1,
        10.9,
        12.2,
        10.2,
        7.6
      ],
      [
        5.7,
        5.1,
        3.5,
        2.3,
        1.9,
        1.1,
        0.4,
        0.3,
        0.4,
        0.5,
        1.9,
        3.6,
        4.7,
        5.8,
        7.1,
        7.8,
        9.7,
        11.8,
        10.9,
        11.7,
        12.8,
        13.2,
        10.9,
        7.3
      ],
      [
        5.4,
        4.3,
        3.2,
        2.1,
        1.6,
        1.1,
        0.6,
        0.2,
        0.2,
        0.4,
        0.6,
        1.8,
        3.4,
        5.2,
        5.2,
        6.9,
        10,
        13,
        13.1,
        14,
        14.1,
        12.9,
        9.4,
        8.6
      ],
      [
        7,
        5.2,
        4.6,
        2.6,
        1.6,
        0.7,
        0.3,
        0,
        0,
        0.3,
        1.3,
        3,
        3.7,
        4.7,
        7,
        8.1,
        10.7,
        12.1,
        11.9,
        12.9,
        12.5,
        13.9,
        12.2,
        11.4
      ],
      [
        9.2,
        7.5,
        5.8,
        3,
        2.1,
        1.2,
        0.7,
        0.6,
        0.7,
        0.7,
        2.1,
        4,
        7,
        7.2,
        8,
        10.3,
        11.4,
        15.6,
        12.8,
        10.9,
        10.3,
        11.2,
        12,
        11
      ],
      [
        10.5,
        7.5,
        5,
        3.7,
        2.6,
        1.4,
        0.9,
        0.5,
        0.9,
        1.9,
        2,
        3.9,
        6.1,
        8.3,
        10.4,
        13.7,
        13.6,
        12.5,
        14.1,
        17.3,
        19.5,
        16.6,
        9.9,
        6.3
      ]
    ]
  }
};

export const MITGLIEDER = [
  {
    "wk": "2025-48",
    "joins": 11,
    "leaves": 0,
    "net": 11
  },
  {
    "wk": "2025-49",
    "joins": 8,
    "leaves": 0,
    "net": 8
  },
  {
    "wk": "2025-50",
    "joins": 9,
    "leaves": 0,
    "net": 9
  },
  {
    "wk": "2025-51",
    "joins": 9,
    "leaves": 0,
    "net": 9
  },
  {
    "wk": "2025-52",
    "joins": 13,
    "leaves": 0,
    "net": 13
  },
  {
    "wk": "2026-01",
    "joins": 14,
    "leaves": 4,
    "net": 10
  },
  {
    "wk": "2026-02",
    "joins": 28,
    "leaves": 14,
    "net": 14
  },
  {
    "wk": "2026-03",
    "joins": 25,
    "leaves": 12,
    "net": 13
  },
  {
    "wk": "2026-04",
    "joins": 36,
    "leaves": 18,
    "net": 18
  },
  {
    "wk": "2026-05",
    "joins": 108,
    "leaves": 31,
    "net": 77
  },
  {
    "wk": "2026-06",
    "joins": 138,
    "leaves": 37,
    "net": 101
  },
  {
    "wk": "2026-07",
    "joins": 110,
    "leaves": 34,
    "net": 76
  },
  {
    "wk": "2026-08",
    "joins": 462,
    "leaves": 43,
    "net": 419
  },
  {
    "wk": "2026-09",
    "joins": 135,
    "leaves": 39,
    "net": 96
  },
  {
    "wk": "2026-10",
    "joins": 91,
    "leaves": 32,
    "net": 59
  },
  {
    "wk": "2026-11",
    "joins": 84,
    "leaves": 24,
    "net": 60
  },
  {
    "wk": "2026-12",
    "joins": 80,
    "leaves": 33,
    "net": 47
  },
  {
    "wk": "2026-13",
    "joins": 57,
    "leaves": 29,
    "net": 28
  },
  {
    "wk": "2026-14",
    "joins": 91,
    "leaves": 42,
    "net": 49
  },
  {
    "wk": "2026-15",
    "joins": 55,
    "leaves": 21,
    "net": 34
  },
  {
    "wk": "2026-16",
    "joins": 59,
    "leaves": 36,
    "net": 23
  },
  {
    "wk": "2026-17",
    "joins": 36,
    "leaves": 25,
    "net": 11
  },
  {
    "wk": "2026-18",
    "joins": 51,
    "leaves": 31,
    "net": 20
  },
  {
    "wk": "2026-19",
    "joins": 52,
    "leaves": 27,
    "net": 25
  },
  {
    "wk": "2026-20",
    "joins": 42,
    "leaves": 24,
    "net": 18
  },
  {
    "wk": "2026-21",
    "joins": 45,
    "leaves": 16,
    "net": 29
  },
  {
    "wk": "2026-22",
    "joins": 48,
    "leaves": 30,
    "net": 18
  },
  {
    "wk": "2026-23",
    "joins": 35,
    "leaves": 23,
    "net": 12
  },
  {
    "wk": "2026-24",
    "joins": 48,
    "leaves": 15,
    "net": 33
  },
  {
    "wk": "2026-25",
    "joins": 53,
    "leaves": 35,
    "net": 18
  },
  {
    "wk": "2026-26",
    "joins": 31,
    "leaves": 28,
    "net": 3
  },
  {
    "wk": "2026-27",
    "joins": 44,
    "leaves": 25,
    "net": 19
  },
  {
    "wk": "2026-28",
    "joins": 37,
    "leaves": 28,
    "net": 9
  },
  {
    "wk": "2026-29",
    "joins": 45,
    "leaves": 32,
    "net": 13
  },
  {
    "wk": "2026-30",
    "joins": 45,
    "leaves": 31,
    "net": 14
  },
  {
    "wk": "2026-31",
    "joins": 56,
    "leaves": 26,
    "net": 30
  },
  {
    "wk": "2026-32",
    "joins": 56,
    "leaves": 21,
    "net": 35
  },
  {
    "wk": "2026-33",
    "joins": 62,
    "leaves": 33,
    "net": 29
  },
  {
    "wk": "2026-34",
    "joins": 42,
    "leaves": 36,
    "net": 6
  },
  {
    "wk": "2026-35",
    "joins": 42,
    "leaves": 31,
    "net": 11
  },
  {
    "wk": "2026-36",
    "joins": 64,
    "leaves": 28,
    "net": 36
  }
];

export const MITGLIEDER_STAND = {
  "present_mensch_ohne_spike": 1722,
  "vorher": 1675,
  "vorher_datum": "2026-08-30",
  "present_mensch": 2559,
  "bans_gesamt": 90,
  "letzter_ban": "2026-06-27"
};

export const TEXT = [
  {
    "wk": "2026-16",
    "convos": 135,
    "msgs": 322
  },
  {
    "wk": "2026-17",
    "convos": 429,
    "msgs": 869
  },
  {
    "wk": "2026-18",
    "convos": 467,
    "msgs": 1069
  },
  {
    "wk": "2026-19",
    "convos": 358,
    "msgs": 625
  },
  {
    "wk": "2026-20",
    "convos": 229,
    "msgs": 411
  },
  {
    "wk": "2026-21",
    "convos": 324,
    "msgs": 763
  },
  {
    "wk": "2026-22",
    "convos": 286,
    "msgs": 560
  },
  {
    "wk": "2026-23",
    "convos": 296,
    "msgs": 614
  },
  {
    "wk": "2026-24",
    "convos": 476,
    "msgs": 1172
  },
  {
    "wk": "2026-25",
    "convos": 421,
    "msgs": 1440
  },
  {
    "wk": "2026-26",
    "convos": 457,
    "msgs": 1057
  },
  {
    "wk": "2026-27",
    "convos": 982,
    "msgs": 2564
  },
  {
    "wk": "2026-28",
    "convos": 535,
    "msgs": 1302
  },
  {
    "wk": "2026-29",
    "convos": 873,
    "msgs": 1994
  },
  {
    "wk": "2026-30",
    "convos": 671,
    "msgs": 1547
  },
  {
    "wk": "2026-31",
    "convos": 996,
    "msgs": 2463
  },
  {
    "wk": "2026-32",
    "convos": 759,
    "msgs": 1746
  },
  {
    "wk": "2026-33",
    "convos": 868,
    "msgs": 2074
  },
  {
    "wk": "2026-34",
    "convos": 692,
    "msgs": 1574
  },
  {
    "wk": "2026-35",
    "convos": 664,
    "msgs": 1539
  },
  {
    "wk": "2026-36",
    "convos": 614,
    "msgs": 1166
  }
];

export const TEXT_START = "2026-04-17";

export const PRESENCE = [
  {
    "monat": "2026-07",
    "median": 1065
  },
  {
    "monat": "2026-08",
    "median": 1105
  },
  {
    "monat": "2026-09",
    "median": 1148
  }
];

export const LEAVE = {
  "gesamt": 384,
  "seit": "2026-05-15",
  "sent": 1,
  "failed": 335,
  "blocked": 48,
  "beantwortet": 0,
  "pro_monat": [
    {
      "monat": "2026-05",
      "n": 15
    },
    {
      "monat": "2026-06",
      "n": 82
    },
    {
      "monat": "2026-07",
      "n": 119
    },
    {
      "monat": "2026-08",
      "n": 133
    },
    {
      "monat": "2026-09",
      "n": 35
    }
  ]
};

export const STEAM = {
  "verified": 322,
  "is_friend": 320,
  "rank_monthly": [
    {
      "monat": "2026-06",
      "konten": 131
    },
    {
      "monat": "2026-07",
      "konten": 216
    },
    {
      "monat": "2026-08",
      "konten": 111
    },
    {
      "monat": "2026-09",
      "konten": 63
    }
  ],
  "rank_weekly": [
    {
      "wk": "2026-26",
      "accts": 124
    },
    {
      "wk": "2026-27",
      "accts": 118
    },
    {
      "wk": "2026-28",
      "accts": 115
    },
    {
      "wk": "2026-29",
      "accts": 135
    },
    {
      "wk": "2026-30",
      "accts": 129
    },
    {
      "wk": "2026-31",
      "accts": 108
    },
    {
      "wk": "2026-32",
      "accts": 75
    },
    {
      "wk": "2026-33",
      "accts": 58
    },
    {
      "wk": "2026-34",
      "accts": 60
    },
    {
      "wk": "2026-35",
      "accts": 57
    },
    {
      "wk": "2026-36",
      "accts": 60
    }
  ],
  "match_referenz": 148,
  "live_frozen_since": "2026-06-09",
  "live_snapshot": {
    "konten": 526,
    "in_deadlock_now": 75,
    "in_match_now_strict": 23,
    "distinct_heroes": 21
  },
  "rich_presence_leer": true,
  "luecke": "2026-08-02..2026-08-07"
};

