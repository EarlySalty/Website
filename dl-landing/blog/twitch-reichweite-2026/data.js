export const STAND = '2026-10-25';

export const ANKUNFT = {
  seit: '2026-05-04',
  sessions: 1123,
  kanaele: 42,
  stammAnteilStart: 92.9,
  ohneErsteAnteil: 93.3,
  zeilen: [
    { key: '0–10', label: '0–10 Min.', neu: 1.3, stamm: 17.2, stammAnteil: 92.9 },
    { key: '10–30', label: '10–30 Min.', neu: 1.8, stamm: 3.8, stammAnteil: 68.1 },
    { key: '30–60', label: '30–60 Min.', neu: 2.2, stamm: 2.5, stammAnteil: 53.3 },
    { key: '60–120', label: '60–120 Min.', neu: 1.8, stamm: 1.8, stammAnteil: 50.1 },
  ],
};

export const ANLAUF = {
  sessions: 833,
  kanaele: 93,
  zeilen: [
    { key: 'Start', anteil: 18.4, sessions: 833 },
    { key: 'Minute 5', anteil: 30.3, sessions: 775 },
    { key: 'Minute 15', anteil: 65.2, sessions: 745 },
    { key: 'Minute 30', anteil: 83.8, sessions: 719 },
  ],
};

export const DAUER = {
  startband: '19 bis 20 Uhr',
  zeilen: [
    { key: 'unter 2 Std.', index: 88.3, von: 83.1, bis: 96.3, sessions: 757 },
    { key: '2 bis 4 Std.', index: 97.6, von: 93.3, bis: 102.3, sessions: 1026 },
    { key: 'ab 4 Std.', index: 106.9, von: 101.6, bis: 112.6, sessions: 687 },
  ],
  langPlusMin: 6,
  langPlusMax: 17,
  kurzMinusMin: 5,
  kurzMinusMax: 15,
  stunde5Min: 1.17,
  stunde5Max: 1.25,
  kleinStunde5: 0.95,
};

export const LIVETAGE = {
  zeitraum: '9. bis 17. Oktober 2026',
  de: { neue: 1648, raeume: 245, ret7: 23.3, liveWieder: 72.1, medianTage: 1, ret7BeiLive: 32.3 },
  alle: { neue: 276854, raeume: 18011, ret7: 23.4, liveWieder: 83.0, medianTage: 4, ret7BeiLive: 28.2 },
  stufen: [
    { key: '0 Tage', de: { n: 459, anteil: 27.9, ret7: 0.0 }, alle: { n: 46955, anteil: 17.0, ret7: 0.2 } },
    { key: '1–2 Tage', de: { n: 609, anteil: 37.0, ret7: 28.6 }, alle: { n: 64043, anteil: 23.1, ret7: 23.7 } },
    { key: '3–4 Tage', de: { n: 300, anteil: 18.2, ret7: 27.7 }, alle: { n: 48549, anteil: 17.5, ret7: 29.8 } },
    { key: '5–7 Tage', de: { n: 280, anteil: 17.0, ret7: 45.4 }, alle: { n: 117307, anteil: 42.4, ret7: 30.0 } },
  ],
  rueckkehrer: 761,
  rueckkehrMedianTage: 2,
  naechsterTag: 38.2,
  burnDe: 20.2,
  burnAlle: 22.8,
};

export const ERSTBESUCH = {
  zeitraum: '20. Februar bis 24. September 2026',
  zeilen: [
    { key: 'still', label: 'still', n: 9272, zurueck: 15.5 },
    { key: '1', label: '1 Nachricht', n: 2868, zurueck: 9.1 },
    { key: '2–4', label: '2–4 Nachrichten', n: 2140, zurueck: 17.4 },
    { key: '5+', label: '5+ Nachrichten', n: 2574, zurueck: 31.3 },
  ],
  zweiPlusPp: 16.9,
  zweiPlusVon: 13.7,
  zweiPlusBis: 20.2,
  keinGespraechAnteil: 30,
  einzelRueckkehrMax: 4.8,
};

export const STILL = [
  { key: '0–4', label: '0 bis 4 Zuschauer', anteil: 70, chatterJeZuschauer: 0.83 },
  { key: '5–19', label: '5 bis 19 Zuschauer', anteil: 78, chatterJeZuschauer: 0.70 },
  { key: '20–99', label: '20 bis 99 Zuschauer', anteil: 86, chatterJeZuschauer: 0.36 },
  { key: '100+', label: 'ab 100 Zuschauer', anteil: 87, chatterJeZuschauer: 0.13 },
];

const ERSTE_ANTWORTEN = 78;

export const ANTWORT = {
  frageAntwort2Min: 2.8,
  ersteAntworten: ERSTE_ANTWORTEN,
  kurzReaktion: 4.7,
  fragen: 34037,
  zeilen: [
    { frage: 'Kommt eine neue Person wieder, wenn der Streamer im Chat auf ihre erste Nachricht antwortet?', ergebnis: '−0,7 Prozentpunkte', intervall: '−6,1 bis +5,3', urteil: 'kein Effekt' },
    { frage: 'Folgt sie eher, wenn die erste Nachricht überhaupt im Kanal schnell beantwortet wird?', ergebnis: '+12,1 Prozentpunkte', intervall: '+4,7 bis +17,3', urteil: `Zusammenhang, ${ERSTE_ANTWORTEN} Antworten` },
    { frage: 'Folgt sie eher, wenn ihre erste Nachricht im Stream beantwortet wird?', ergebnis: '+2,3 Prozentpunkte', intervall: '−0,3 bis +4,6', urteil: 'knapp, nicht sicher' },
    { frage: 'Schreibt in den nächsten fünf Minuten jemand Neues, wenn der Streamer tippt?', ergebnis: '+1,4 Prozentpunkte', intervall: '−2,3 bis +5,1', urteil: 'kein Effekt' },
    { frage: 'Zieht ein laufender Chat neue Schreiber an?', ergebnis: '+0,0 Prozentpunkte', intervall: '−0,7 bis +0,6', urteil: 'kein Effekt' },
  ],
};

export const RAID = {
  proRaider: [
    { key: 'alle Ziele', raids: 346, gesendet: 4.31, m15: 0.18, m30: 0.13, m60: 0.11 },
    { key: 'Ziel 1 bis 4 Zuschauer', raids: 257, gesendet: 4.32, m15: 0.19, m30: 0.19, m60: 0.19 },
    { key: 'Ziel 5 bis 19 Zuschauer', raids: 78, gesendet: 4.27, m15: 0.11, m30: -0.08, m60: -0.07 },
    { key: 'Ziel ab 20 Zuschauer', raids: 11, gesendet: 4.36, m15: 0.35, m30: 0.29, m60: -0.30 },
  ],
  m60Von: 0.11,
  m60Bis: 0.30,
  stilleNeueJeRaid: 1.0,
  neueChatterJeRaid: 0.12,
  follows: [
    { key: 'nach Raid', label: '10 Minuten nach einem Raid', wert: 7.9, follows: 63 },
    { key: 'sonst', label: 'restliche Sendezeit', wert: 2.7, follows: 1189 },
  ],
  followKontrolle: { wert: 0.037, von: -0.018, bis: 0.091, raids: 205 },
  rueckkehrRaid: 22.2,
  rueckkehrOrganisch: 20.9,
};

export const ENDE = {
  paare: 3045,
  kanaele: 73,
  zeilen: [
    { key: 'roh', label: 'ohne Abgleich', paare: 3045, wert: 1.1, von: -1.1, bis: 3.0 },
    { key: 'niveau', label: 'Niveau abgeglichen', paare: 3045, wert: 0.8, von: -1.4, bis: 2.5 },
    { key: 'voll', label: 'plus Länge und Spitze', paare: 3045, wert: 0.8, von: -1.5, bis: 2.5 },
    { key: 'placebo', label: 'Placebo: vorheriger Start', paare: 2993, wert: -0.7, von: -2.7, bis: 1.5 },
  ],
  gross: { wert: 4.2, von: -0.3, bis: 9.7, kanaele: 13, paare: 418 },
  neustartLuecke: 10,
  scheinEffekt: 8.4,
};

export const FOLLOW = {
  erfasst: 1492,
  erfasstKanaele: 63,
  offline: 214,
  ohneMessung: 26,
  follows: 1252,
  kanaele: 58,
  ohneMinute: 0,
  gesamtJe100: 2.8,
  vorSpitzeJe100: 11.5,
  zeilen: [
    { key: '0–10', n: 60, wert: 12.6 },
    { key: '10–20', n: 63, wert: 7.3 },
    { key: '20–30', n: 57, wert: 5.6 },
    { key: '30–45', n: 88, wert: 4.9 },
    { key: '45–60', n: 82, wert: 4.2 },
    { key: '60–90', n: 121, wert: 2.9 },
    { key: '90–120', n: 110, wert: 2.7 },
    { key: '120–180', n: 182, wert: 2.4 },
    { key: '180–240', n: 129, wert: 2.1 },
    { key: '240–360', n: 125, wert: 1.6 },
    { key: '360+', n: 235, wert: 2.7 },
  ],
  stillJe1000: 10.2,
  chatterJe1000: 81.6,
  nieGechattet: 35.5,
  geschenkt: { n: 166, chat30: 14.5, resub: 0.0 },
  bezahlt: { n: 132, chat30: 75.8, resub: 37.1 },
};

export const NULL = [
  { idee: 'Tags, Anzahl der Tags, der Deutsch-Tag', ergebnis: 'kein messbarer Effekt auf Zuschauer, Chat oder Follower' },
  { idee: 'Wörter im Titel („!discord“, „chill“, „neu“, Klammern)', ergebnis: 'gegen Streams desselben Kanals aus denselben zwei Wochen klein und unsicher, siehe Titeltabelle' },
  { idee: 'Titel unter 30 Zeichen', ergebnis: 'rund 2 Prozent weniger Zuschauer (−1,7 %, Intervall −4,4 bis −0,1)' },
  { idee: 'Titel während des Streams ändern', ergebnis: '+0,1 Prozent' },
  { idee: 'Startzeit und Wochentag', ergebnis: 'gleicher Kanal, andere Uhrzeit: kein Unterschied; nur Starts ab 23 Uhr liegen bei sehr kleinen Kanälen rund 8 Prozent unter dem eigenen Schnitt' },
  { idee: 'Aufhören, solange der Raum voll ist', ergebnis: 'kein höherer nächster Start, sobald kurze Abbrüche als ein Stream zählen' },
  { idee: 'Volle Abende meiden', ergebnis: 'mehr deutsche Streams gleichzeitig kosten keine neuen Zuschauer' },
  { idee: 'Live-Benachrichtigung', ergebnis: 'kein höherer Start' },
  { idee: 'Geteilter Chat (Shared Chat)', ergebnis: 'kein belastbarer Effekt' },
  { idee: 'Selbst raiden', ergebnis: 'kein eigenes Wachstum, kein höherer nächster Start' },
  { idee: 'Patch-Tage, Feiertage', ergebnis: 'kein verlässlicher Effekt' },
  { idee: 'fester Wochenplan, Pausen von 7 bis 30 Tagen', ergebnis: 'kein messbarer Effekt auf das Zuschauerniveau' },
  { idee: 'weit oben in der deutschen Liste stehen, Schwung aus dem letzten Stream', ergebnis: 'innerhalb desselben Kanals kein Effekt' },
];

export const WACHSTUM = {
  kanaele: 110,
  wachser: 5,
  anteil: 4.5,
  weltKanaele: 8203,
  weltWachser: 36,
};

export const STARTZEIT = [
  { key: 'bis 14 Uhr', index: 102.7, sessions: 2747 },
  { key: '15 bis 16 Uhr', index: 97.9, sessions: 1061 },
  { key: '17 bis 18 Uhr', index: 99.5, sessions: 1482 },
  { key: '19 bis 20 Uhr', index: 99.7, sessions: 2016 },
  { key: '21 bis 22 Uhr', index: 99.6, sessions: 1373 },
  { key: 'ab 23 Uhr', index: 92.2, sessions: 404 },
];

export const TITEL = {
  sessions: 10917,
  zeilen: [
    { merkmal: 'Befehl im Titel („!discord“, „!socials“)', roh: 12.8, abgleich: 3.1, kanaele: 27, von: -2.7, bis: 9.4 },
    { merkmal: 'Wort „discord“', roh: 22.5, abgleich: 5.7, kanaele: 14, von: 3.1, bis: 24.7 },
    { merkmal: 'Klammer-Tag', roh: 9.2, abgleich: 0.5, kanaele: 29 },
    { merkmal: 'Titel unter 30 Zeichen', roh: -3.3, abgleich: -1.7, kanaele: 137, von: -4.4, bis: -0.1 },
    { merkmal: 'Wort „chill“', roh: -13.0, abgleich: -0.8, kanaele: 29 },
  ],
};
