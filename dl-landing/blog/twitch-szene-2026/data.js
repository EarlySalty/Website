/**
 * Zahlen zum Blogpost "Zehn Monate deutsche Deadlock-Streamer auf Twitch".
 *
 * Erhoben am 22.08.2026 aus der Twitch-Analytics-Datenbank der Community,
 * Zeitraum 10.10.2025 bis 22.08.2026, 4.220.094 gefilterte Snapshot-Zeilen.
 *
 * Achtung beim Weiterrechnen: Das Messintervall des Scouts ist nicht konstant.
 * Median-Abstand zweier Durchlaeufe: 300 s bis 17.01.2026, 75 s bis 11.03.2026,
 * danach 15 bis 16 s. Zeilenzaehlungen und Anteile ueber Zeilen (VIEWER_KLASSEN,
 * HEATMAP) sind dadurch auf die spaeten Monate gewichtet. Kennzahlen je Snapshot
 * oder je Kanal (WOCHEN, PATCHES, UEBERLEBEN, SESSIONDAUER) sind davon unberuehrt.
 * Die Werte stehen als Literale hier drin: die Seite ist statisch und soll
 * auch dann stimmen, wenn kein Dienst laeuft. Beim naechsten Stichtag wird
 * dieser Block ersetzt, nicht ergaenzt.
 *
 * Herkunft der einzelnen Bloecke steht im Methodik-Kapitel der Seite.
 */

/** Woche (Montag) | aktive Streamer | Primetime-Viewer im Schnitt | gleichzeitige Streams in der Primetime */
export const WOCHEN = [
  ["2025-10-06", 27, 18.7, 4.1],
  ["2025-10-13", 62, 10.9, 3.3],
  ["2025-10-20", 72, 22.2, 4.1],
  ["2025-10-27", 54, 15.7, 3.1],
  ["2025-11-03", 48, 17.4, 3.0],
  ["2025-11-10", 53, 8.5, 3.6],
  ["2025-11-17", 50, 8.9, 3.5],
  ["2025-11-24", 46, 8.9, 2.9],
  ["2025-12-01", 34, 11.5, 2.9],
  ["2025-12-08", 46, 11.5, 3.6],
  ["2025-12-15", 46, 8.5, 3.8],
  ["2025-12-22", 55, 7.6, 3.6],
  ["2025-12-29", 45, 8.3, 2.8],
  ["2026-01-05", 49, 9.3, 3.9],
  ["2026-01-12", 48, 8.2, 3.1],
  ["2026-01-19", 79, 19.9, 6.1],
  ["2026-01-26", 124, 63.9, 9.9],
  ["2026-02-02", 172, 41.6, 12.2],
  ["2026-02-09", 195, 492.1, 14.2],
  ["2026-02-16", 233, 1460.7, 20.2],
  ["2026-02-23", 204, 357.4, 19.8],
  ["2026-03-02", 229, 238.3, 18.5],
  ["2026-03-09", 261, 413.5, 16.0],
  ["2026-03-16", 245, 189.1, 13.6],
  ["2026-03-23", 211, 170.8, 15.4],
  ["2026-03-30", 177, 76.5, 11.7],
  ["2026-04-06", 164, 187.0, 12.7],
  ["2026-04-13", 134, 56.7, 10.4],
  ["2026-04-20", 140, 314.7, 11.6],
  ["2026-04-27", 118, 101.7, 8.8],
  ["2026-05-04", 124, 88.1, 10.6],
  ["2026-05-11", 139, 80.6, 10.3],
  ["2026-05-18", 118, 58.5, 8.9],
  ["2026-05-25", 121, 43.9, 9.0],
  ["2026-06-01", 103, 50.5, 8.3],
  ["2026-06-08", 93, 42.7, 7.8],
  ["2026-06-15", 77, 23.9, 6.1],
  ["2026-06-22", 73, 27.4, 5.0],
  ["2026-06-29", 82, 19.4, 4.7],
  ["2026-07-06", 75, 22.0, 5.4],
  ["2026-07-13", 89, 24.0, 6.5],
  ["2026-07-20", 74, 37.1, 5.9],
  ["2026-07-27", 103, 180.2, 8.3],
  ["2026-08-03", 113, 63.7, 8.5],
  ["2026-08-10", 120, 42.8, 8.9],
  ["2026-08-17", 107, 53.7, 8.5],
];

/** Zufallsstichprobe aller Sprachen aus der Juni-Stoerung: Tag | Streamer gesamt | davon deutsch */
export const SPRACHPROBE = [["2026-06-11", 2585, 21], ["2026-06-12", 2587, 38], ["2026-06-13", 1602, 27]];
export const ANTEIL_DE_PROZENT = 1.3;

/** Monat | Neuzugaenge | Abgaenge | Netto. August 2026 ist unvollstaendig (Abgang braucht 30 Tage Stille). */
export const ZU_UND_ABGANG = [
  ["2025-10", 128, 65, 63],
  ["2025-11", 95, 60, 35],
  ["2025-12", 68, 54, 14],
  ["2026-01", 137, 90, 47],
  ["2026-02", 388, 298, 90],
  ["2026-03", 427, 422, 5],
  ["2026-04", 211, 251, -40],
  ["2026-05", 186, 204, -18],
  ["2026-06", 98, 126, -28],
  ["2026-07", 80, 90, -10],
  ["2026-08", 112, 0, 112],
];

export const OKTOBER_KOHORTE = {"groesse": 128, "nochAktiv": 17, "anteil": 13.3};

/**
 * Ueberlebensraten. Eine Zensierungsregel fuer alle Fenster und fuer Kapitel 7:
 * ein Kanal ist fuer das N-Tage-Fenster bewertbar, wenn first_seen + N + 14 Tage
 * noch in den Daten liegt, das Messfenster also vollstaendig beobachtet wurde.
 */
export const UEBERLEBEN = [
  { tage: 30, anteil: 11.1, bewertbar: 1761 },
  { tage: 90, anteil: 6.8, bewertbar: 1507 },
  { tage: 180, anteil: 7.7, bewertbar: 530 },
];
export const AUFGABE = {"medianSessions": 1, "aufgegeben": 1660, "comeback": 274, "mehrfachStreamer": 917, "returnRate": 29.9};

/** Snapshots je Wochentag (Zeile, 0 = Montag) und Stunde (Spalte, 0 bis 23), Europe/Berlin. */
export const HEATMAP = [
  [30286, 18141, 9843, 6139, 4425, 2819, 2684, 2236, 2098, 2638, 4163, 7677, 11363, 14504, 19076, 21774, 24582, 30541, 40286, 52710, 63357, 69964, 65717, 47706],
  [32350, 22076, 13147, 6753, 4036, 2303, 2510, 2594, 2952, 5072, 7341, 8895, 11956, 14422, 17431, 20793, 25034, 29804, 37951, 49153, 60713, 64331, 62495, 48082],
  [28736, 20161, 14223, 8756, 5024, 2342, 1781, 2057, 2898, 4615, 5972, 9461, 11433, 14976, 17600, 20918, 22264, 26409, 35579, 48700, 58343, 62883, 58746, 45021],
  [31402, 24057, 13799, 8277, 5125, 1935, 1030, 1854, 2849, 4708, 7653, 11070, 13107, 15878, 19201, 20976, 23137, 24232, 30789, 43176, 60255, 69019, 66984, 56037],
  [40024, 26830, 17773, 11536, 6427, 3586, 3324, 2902, 3823, 5437, 10108, 13096, 14101, 19178, 25558, 29051, 31850, 35560, 40964, 50913, 55056, 64649, 71520, 65955],
  [49716, 32601, 18860, 10042, 6362, 3398, 2808, 3352, 4330, 5783, 9018, 13333, 18344, 24186, 29990, 32961, 36955, 40286, 41760, 46974, 53914, 57882, 62664, 58680],
  [49651, 34368, 20837, 12711, 8634, 4971, 3859, 3525, 3617, 4859, 10132, 15635, 23835, 29053, 34901, 40971, 46677, 48190, 49791, 51671, 54645, 59099, 58425, 44246],
];

export const SESSIONDAUER = [["0-30min", 1545], ["30-60min", 1572], ["1-2h", 2850], ["2-4h", 3972], ["4h+", 1948]];
export const SESSIONS_PRO_WOCHE = { median: 1, schnitt: 2.37 };

/** Viewer-Klasse je Snapshot-Zeile. */
export const VIEWER_KLASSEN = [["0-2", 2098417], ["3-9", 1612834], ["10-49", 399836], ["50+", 109007]];
export const VIEWER_META = {"zeilen": 4220094, "sessionsGesamt": 11887, "sessionsLeer": 3988, "sessionsLeerPct": 33.5, "top10Pct": 94.5};

/**
 * Patch | Titel | gleichzeitige Streams in der Primetime vorher/nachher | Viewer je Stream vorher/nachher
 *
 * Die Streamzahl ist bewusst dieselbe Groesse wie in Kapitel 1: Zahl der
 * gleichzeitig laufenden Streams je Snapshot, gemittelt ueber alle Snapshots
 * zwischen 18 und 24 Uhr Europe/Berlin. Frueher stand hier die Zahl der
 * unterschiedlichen Kanaele je Tag, die rund viermal so hoch liegt und sich
 * nicht mit dem Primetime-Hoechststand von 20,2 aus Kapitel 1 vergleichen laesst.
 */
export const PATCHES = [
  ["2026-01-26", "Rem Hero-Release", 6.1, 9.9, 3.05, 4.6],
  ["2026-01-29", "Graves Hero-Release", 9.0, 10.5, 3.03, 5.16],
  ["2026-02-02", "Silver Hero-Release", 9.9, 12.2, 4.6, 5.57],
  ["2026-02-05", "Venator Hero-Release", 10.5, 13.4, 5.16, 23.57],
  ["2026-02-09", "Celeste Hero-Release", 12.2, 14.2, 5.57, 28.74],
  ["2026-02-12", "Apollo Hero-Release", 13.4, 16.1, 23.57, 43.5],
  ["2026-03-06", "Gameplay Update 03-06", 19.0, 16.9, 36.48, 16.18],
  ["2026-04-30", "Gameplay Update 04-30", 10.4, 9.2, 10.26, 10.21],
  ["2026-05-22", "Gameplay Update 05-22", 9.1, 8.9, 6.25, 10.18],
];

export const NETZWERK = {"groesse": 67, "imNetz": {"n": 64, "medianStart": 2.87, "medianStartJeKanal": 2, "startP25": 1, "startP75": 3, "ueberleben90": 53.1, "bewertbar90": 49, "sessionsProWoche": 3.81}, "ausserhalb": {"n": 1866, "medianStart": 19.08, "medianStartJeKanal": 1, "ueberleben90": 5.3, "bewertbar90": 1458, "sessionsProWoche": 2.11}, "beitritt": {"n": 51, "vor": 2.02, "nach": 2.22}, "streams": {"r5": 0.843, "r10": 0.842, "r20": 0.83, "erstchatter": 5028, "stammchatter": 15957, "sessions": 3793, "erstchatterPct": 24.0}};

/**
 * Beitritte ins Streamer-Netzwerk je Monat. Beitrittsdatum ist der frueheste
 * Zeitstempel aus twitch_streamers.created_at, twitch_partners.partnered_at und
 * twitch_raid_auth.authorized_at. Austritte sind darin nicht abgebildet, die
 * Reihe zeigt Zugaenge, nicht den Bestand.
 */
export const NETZWERK_BEITRITTE = [
  ["2025-10", 5],
  ["2025-11", 1],
  ["2025-12", 1],
  ["2026-01", 3],
  ["2026-02", 17],
  ["2026-03", 7],
  ["2026-04", 6],
  ["2026-05", 7],
  ["2026-06", 10],
  ["2026-07", 5],
  ["2026-08", 5],
];

/** Wie lange die 67 Netzwerk-Kanaele am Stichtag dabei sind. */
export const NETZWERK_ALTER = { gesamt: 67, medianTage: 151, unter90Tage: 23, unter180Tage: 44 };

/**
 * Raid-Wirkung, gemessen am Zuschauerverlauf des Ziels statt an Chatter-Zaehlern.
 * Basis ist der Mittelwert der Zuschauerzahl des Ziels in den zehn Minuten vor
 * dem Raid, verglichen mit dem Fenster um plus zehn und plus zwanzig Minuten.
 * Bewertbar sind nur Raids, fuer die in allen drei Fenstern Messpunkte liegen.
 */
export const RAIDS = {
  gesamt: 1589,
  erfolgreich: 1404,
  bewertbar: 1058,
  ziele: 232,
  medianGesendet: 2,
  medianBasis: 2,
  medianZuwachs10: 0.33,
  medianZuwachs20: 0.19,
  halbeDa10: 32.1,
  halbeDa20: 30.1,
  volleDa20: 14.4,
  ueberhauptMehr20: 52.1,
  faktor10: 1.11,
  faktor20: 1.04,
  faktor20P75: 1.67,
};

/** Raid-Wirkung nach Groesse des Raids. Zuwachs in Zuschauern, Anteile in Prozent. */
export const RAID_GROESSEN = [
  { klasse: "1 Zuschauer", n: 411, basis: 1.72, gesendet: 1, zuwachs10: 0, zuwachs20: 0, halb10: 35.8, halb20: 36.0 },
  { klasse: "2 bis 3", n: 377, basis: 2, gesendet: 2, zuwachs10: 0.41, zuwachs20: 0.22, halb10: 33.4, halb20: 29.4 },
  { klasse: "4 bis 6", n: 201, basis: 2, gesendet: 4, zuwachs10: 1, zuwachs20: 1, halb10: 27.9, halb20: 24.9 },
  { klasse: "7 und mehr", n: 69, basis: 2, gesendet: 8, zuwachs10: 1.61, zuwachs20: 1.63, halb10: 15.9, halb20: 13.0 },
];

/** Gematchte Paare: gleicher Startmonat, gleicher Groessen-Bucket. Nur Paare, bei denen beide Seiten nach drei Monaten noch messbar sind. */
export const MATCHED = [
  { monat: "2025-10", bucket: 3, netzStart: 1, netzM3: 1, ctrlStart: 1, ctrlM3: 1.4, nNetz: 2, nCtrl: 36 },
  { monat: "2025-10", bucket: 4, netzStart: 2, netzM3: 1.67, ctrlStart: 2.33, ctrlM3: 2.5, nNetz: 4, nCtrl: 32 },
  { monat: "2025-11", bucket: 3, netzStart: 1, netzM3: 1, ctrlStart: 1.03, ctrlM3: 1.44, nNetz: 3, nCtrl: 30 },
  { monat: "2025-11", bucket: 4, netzStart: 3, netzM3: 4, ctrlStart: 2.53, ctrlM3: 3, nNetz: 1, nCtrl: 19 },
  { monat: "2025-11", bucket: 5, netzStart: 4, netzM3: 2, ctrlStart: 5.42, ctrlM3: 5, nNetz: 1, nCtrl: 6 },
  { monat: "2025-12", bucket: 3, netzStart: 1, netzM3: 1, ctrlStart: 1, ctrlM3: 1.25, nNetz: 1, nCtrl: 19 },
  { monat: "2025-12", bucket: 4, netzStart: 2, netzM3: 2.33, ctrlStart: 2.14, ctrlM3: 1, nNetz: 3, nCtrl: 7 },
  { monat: "2026-01", bucket: 4, netzStart: 2.33, netzM3: 1.5, ctrlStart: 2.33, ctrlM3: 2.17, nNetz: 3, nCtrl: 32 },
  { monat: "2026-02", bucket: 3, netzStart: 1.06, netzM3: 1.67, ctrlStart: 1.0, ctrlM3: 1.17, nNetz: 9, nCtrl: 140 },
  { monat: "2026-02", bucket: 4, netzStart: 2.5, netzM3: 2, ctrlStart: 2.37, ctrlM3: 2, nNetz: 2, nCtrl: 94 },
  { monat: "2026-02", bucket: 5, netzStart: 4, netzM3: 5, ctrlStart: 4.95, ctrlM3: 4.17, nNetz: 1, nCtrl: 74 },
  { monat: "2026-03", bucket: 5, netzStart: 4.33, netzM3: 5, ctrlStart: 4.92, ctrlM3: 9, nNetz: 3, nCtrl: 60 },
  { monat: "2026-04", bucket: 3, netzStart: 1, netzM3: 1, ctrlStart: 1, ctrlM3: 1.4, nNetz: 3, nCtrl: 82 },
  { monat: "2026-04", bucket: 4, netzStart: 2, netzM3: 2.5, ctrlStart: 2.25, ctrlM3: 2.38, nNetz: 2, nCtrl: 40 },
  { monat: "2026-04", bucket: 6, netzStart: 12, netzM3: 24, ctrlStart: 9.92, ctrlM3: 9, nNetz: 1, nCtrl: 13 },
  { monat: "2026-05", bucket: 3, netzStart: 1, netzM3: 1, ctrlStart: 1, ctrlM3: 1.17, nNetz: 2, nCtrl: 61 },
  { monat: "2026-05", bucket: 4, netzStart: 2, netzM3: 2.5, ctrlStart: 2.37, ctrlM3: 2.5, nNetz: 3, nCtrl: 35 },
];

export const METHODIK = {"start": "2025-10-10", "ende": "2026-08-22", "zeilenRoh": 9083175, "zeilenVerworfenSprache": 2871252, "zeilenVerworfenStoerung": 1991829, "zeilenBehalten": 4220094, "sessions": 11887, "streamer": 1930, "stoerungstage": ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13"], "sendezeitStunden": 28244, "intervallSekunden": [["2025-10-10", 300], ["2026-01-18", 75], ["2026-03-12", 15], ["2026-06-01", 16]]};
