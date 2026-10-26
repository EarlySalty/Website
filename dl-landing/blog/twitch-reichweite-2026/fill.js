import {
  STAND, ANKUNFT, ANLAUF, DAUER, LIVETAGE, ERSTBESUCH, STILL, ANTWORT, RAID, ENDE, FOLLOW,
  STARTZEIT, TITEL, WACHSTUM,
} from './data.js';

import { datumLang } from '../../src/charts.js';

const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const n0 = (n) => nf0.format(n);
export const d1 = (n) => nf1.format(n);
export const d2 = (n) => nf2.format(n);
export const p1 = (n) => `${d1(n)} %`;
const signed = (text, n) => (n < 0 ? `−${text}` : `+${text}`);
export const s1 = (n) => signed(d1(Math.abs(n)), n);
export const s2 = (n) => signed(d2(Math.abs(n)), n);

const [ank0] = ANKUNFT.zeilen;
const neuWerte = ANKUNFT.zeilen.map((z) => z.neu);
const [dKurz, dMittel, dLang] = DAUER.zeilen;
const [lt0, lt12, lt34, lt57] = LIVETAGE.stufen;
const [ebStill, eb1, eb24, eb5] = ERSTBESUCH.zeilen;
const stillKlein = STILL[0];
const stillGross = STILL[STILL.length - 1];
const raidKlein = RAID.proRaider[1];
const [folRaid, folSonst] = RAID.follows;
const [endeRoh, , endeVoll, endePlacebo] = ENDE.zeilen;
const spaet = STARTZEIT[STARTZEIT.length - 1];
const [befehlTitel, discordTitel] = TITEL.zeilen;
const kurzTitel = TITEL.zeilen[3];
const iv = (z) => `${s1(z.von)} bis ${s1(z.bis)}`;

export const FILL = {
  stand: datumLang(STAND),
  ankSeit: datumLang(ANKUNFT.seit),
  ankSessions: n0(ANKUNFT.sessions),
  ankKanaele: n0(ANKUNFT.kanaele),
  ankStamm: p1(ANKUNFT.stammAnteilStart),
  ankStammZahl: d1(ANKUNFT.stammAnteilStart),
  ankStammWert: d1(ank0.stamm),
  ankNeuMin: d1(Math.min(...neuWerte)),
  ankNeuMax: d1(Math.max(...neuWerte)),
  ankOhneErste: p1(ANKUNFT.ohneErsteAnteil),
  anlaufStart: p1(ANLAUF.zeilen[0].anteil),
  anlauf5: p1(ANLAUF.zeilen[1].anteil),
  anlauf15: p1(ANLAUF.zeilen[2].anteil),
  anlauf30: p1(ANLAUF.zeilen[3].anteil),
  anlaufSessions: n0(ANLAUF.sessions),
  anlaufKanaele: n0(ANLAUF.kanaele),
  dauerKurz: d1(dKurz.index),
  dauerMittel: d1(dMittel.index),
  dauerLang: d1(dLang.index),
  dauerSessions: n0(DAUER.zeilen.reduce((a, z) => a + z.sessions, 0)),
  langPlus: `${n0(DAUER.langPlusMin)} bis ${n0(DAUER.langPlusMax)} Prozent`,
  kurzMinus: `${n0(DAUER.kurzMinusMin)} bis ${n0(DAUER.kurzMinusMax)} Prozent`,
  stunde5: `${d2(DAUER.stunde5Min)}- bis ${d2(DAUER.stunde5Max)}-Fache`,
  kleinStunde5: d2(DAUER.kleinStunde5),
  ltZeitraum: LIVETAGE.zeitraum,
  ltDeNeue: n0(LIVETAGE.de.neue),
  ltDeRaeume: n0(LIVETAGE.de.raeume),
  ltAlleNeue: n0(LIVETAGE.alle.neue),
  ltAlleRaeume: n0(LIVETAGE.alle.raeume),
  ltDeRet: p1(LIVETAGE.de.ret7),
  ltAlleRet: p1(LIVETAGE.alle.ret7),
  ltDeLive: p1(LIVETAGE.de.liveWieder),
  ltDeLiveZahl: d1(LIVETAGE.de.liveWieder),
  ltAlleLive: p1(LIVETAGE.alle.liveWieder),
  ltDeMedian: n0(LIVETAGE.de.medianTage),
  ltAlleMedian: n0(LIVETAGE.alle.medianTage),
  ltDe0: p1(lt0.de.anteil),
  ltDe12Ret: p1(lt12.de.ret7),
  ltDe34Ret: p1(lt34.de.ret7),
  ltDe57Ret: p1(lt57.de.ret7),
  ltAlle57Ret: p1(lt57.alle.ret7),
  ltRueckMedian: n0(LIVETAGE.rueckkehrMedianTage),
  ltNaechster: p1(LIVETAGE.naechsterTag),
  ltBurnDe: p1(LIVETAGE.burnDe),
  ltBurnAlle: p1(LIVETAGE.burnAlle),
  ebZeitraum: ERSTBESUCH.zeitraum,
  ebStill: p1(ebStill.zurueck),
  eb1: p1(eb1.zurueck),
  eb24: p1(eb24.zurueck),
  eb5: p1(eb5.zurueck),
  eb5Zahl: d1(eb5.zurueck),
  ebGesamt: n0(ERSTBESUCH.zeilen.reduce((a, z) => a + z.n, 0)),
  ebKeinGespraech: `${n0(ERSTBESUCH.keinGespraechAnteil)} %`,
  ebEinzelMax: p1(ERSTBESUCH.einzelRueckkehrMax),
  ebZweiPlus: d1(ERSTBESUCH.zweiPlusPp),
  ebZweiPlusIv: `${d1(ERSTBESUCH.zweiPlusVon)} bis ${d1(ERSTBESUCH.zweiPlusBis)}`,
  stillKlein: `${n0(stillKlein.anteil)} %`,
  stillGross: `${n0(stillGross.anteil)} %`,
  chatterKlein: d2(stillKlein.chatterJeZuschauer),
  chatterGross: d2(stillGross.chatterJeZuschauer),
  antwortRate: p1(ANTWORT.frageAntwort2Min),
  antwortFragen: n0(ANTWORT.fragen),
  antwortKurz: `+${d1(ANTWORT.kurzReaktion)} %`,
  raidKlein60: d2(raidKlein.m60),
  raidKleinIv: `${d2(RAID.m60Von)} bis ${d2(RAID.m60Bis)}`,
  raidKleinN: n0(raidKlein.raids),
  raidStille: d1(RAID.stilleNeueJeRaid),
  raidChatter: d2(RAID.neueChatterJeRaid),
  raidFollow: d1(folRaid.wert),
  raidSonst: d1(folSonst.wert),
  raidRueck: p1(RAID.rueckkehrRaid),
  raidOrganisch: p1(RAID.rueckkehrOrganisch),
  endePaare: n0(ENDE.paare),
  endeKanaele: n0(ENDE.kanaele),
  endeRoh: s1(endeRoh.wert),
  endeRohIv: iv(endeRoh),
  endeVoll: s1(endeVoll.wert),
  endeVollIv: iv(endeVoll),
  endePlacebo: s1(endePlacebo.wert),
  endePlaceboIv: iv(endePlacebo),
  endeGross: s1(ENDE.gross.wert),
  endeGrossIv: iv(ENDE.gross),
  endeGrossN: n0(ENDE.gross.kanaele),
  endeLuecke: n0(ENDE.neustartLuecke),
  endeSchein: d1(ENDE.scheinEffekt),
  folErfasst: n0(FOLLOW.erfasst),
  folErfasstKanaele: n0(FOLLOW.erfasstKanaele),
  folOffline: n0(FOLLOW.offline),
  folOhneMessung: n0(FOLLOW.ohneMessung),
  folN: n0(FOLLOW.follows),
  folKanaele: n0(FOLLOW.kanaele),
  folMitMinute: n0(FOLLOW.zeilen.reduce((a, z) => a + z.n, 0)),
  folOhneMinute: n0(FOLLOW.ohneMinute),
  folMedian: n0(FOLLOW.medianMinute),
  folNach60: p1(FOLLOW.nachStunde1),
  folGesamt: d1(FOLLOW.gesamtJe100),
  folSpitze: d1(FOLLOW.vorSpitzeJe100),
  folErsteMin: d1(Math.min(...FOLLOW.zeilen.slice(0, 5).map((z) => z.wert))),
  folErsteMax: d1(Math.max(...FOLLOW.zeilen.slice(0, 5).map((z) => z.wert))),
  folSpaetMin: d1(Math.min(...FOLLOW.zeilen.slice(5).map((z) => z.wert))),
  folSpaetMax: d1(Math.max(...FOLLOW.zeilen.slice(5).map((z) => z.wert))),
  folStill: d1(FOLLOW.stillJe1000),
  folChatter: d1(FOLLOW.chatterJe1000),
  folNie: p1(FOLLOW.nieGechattet),
  subGeschenktN: n0(FOLLOW.geschenkt.n),
  subGeschenktChat: p1(FOLLOW.geschenkt.chat30),
  subBezahltN: n0(FOLLOW.bezahlt.n),
  subBezahltChat: p1(FOLLOW.bezahlt.chat30),
  subBezahltResub: p1(FOLLOW.bezahlt.resub),
  spaetIndex: d1(spaet.index),
  titelSessions: n0(TITEL.sessions),
  titelKurz: `${s1(kurzTitel.abgleich)} %`,
  titelKurzIv: iv(kurzTitel),
  titelBefehl: `${s1(befehlTitel.abgleich)} %`,
  titelBefehlIv: iv(befehlTitel),
  titelDiscord: `${s1(discordTitel.abgleich)} %`,
  titelDiscordIv: iv(discordTitel),
  titelDiscordN: n0(discordTitel.kanaele),
  wachsAnteil: p1(WACHSTUM.anteil),
  wachsKanaele: n0(WACHSTUM.kanaele),
  weltWachser: n0(WACHSTUM.weltWachser),
  weltKanaele: n0(WACHSTUM.weltKanaele),
};
