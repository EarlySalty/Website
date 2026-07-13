// Vertragstest fuer den Rangfarben-Filter. Ausfuehren: node scripts/test-patina.mjs
import assert from 'node:assert/strict'
import { patina, hslToHex } from '../src/patina.js'

/** Die echten In-Game-Rangfarben aus activity.js (RANK_COLORS). */
const RANK_COLORS = {
  initiate: '#8fa4b4',
  seeker: '#72aa5a',
  alchemist: '#3dbb44',
  arcanist: '#18bba8',
  ritualist: '#2288ee',
  emissary: '#5055ee',
  archon: '#8833dd',
  oracle: '#cc33bb',
  phantom: '#dd3344',
  ascendant: '#ee9922',
  eternus: '#f5cc11',
}

const HEX6 = /^#[0-9a-f]{6}$/i

function toHsl(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  const [r, g, b] = m.slice(1).map((p) => parseInt(p, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s, l }
}

/** Kleinster Winkel zwischen zwei Hues (0..180) — 359° und 1° sind 2° auseinander. */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// 1. Ausgabe bleibt immer #rrggbb. colorWithAlpha() in activity.js haengt stumpf ein Alpha-Paar
//    an und faellt sonst still auf Gold zurueck — ein anderes Format wuerde jede Rangfarbe in
//    den Flaechen der Linien-Charts unbemerkt zu Gold machen.
for (const [rank, hex] of Object.entries(RANK_COLORS)) {
  assert.match(patina(hex), HEX6, `${rank}: Ausgabe ist kein #rrggbb`)
}

// 2. Der Rang bleibt in seiner Farbfamilie. Der Gold-Unterton darf den Farbton leicht waermen
//    (Blau -> Navy, Magenta -> Weinrot), aber ein blauer Rang darf nicht gruen werden.
//    Ausgenommen sind fast graue Raenge (Initiate): bei Saettigung nahe null traegt der
//    Farbton keine Information mehr, dort zaehlt nur, dass die Farbe grau bleibt.
for (const [rank, hex] of Object.entries(RANK_COLORS)) {
  const before = toHsl(hex)
  const after = toHsl(patina(hex))
  if (after.s < 0.1) {
    assert.ok(before.s < 0.3, `${rank}: farbiger Rang zu Grau eingedampft`)
    continue
  }
  assert.ok(
    hueDistance(before.h, after.h) <= 25,
    `${rank}: Farbfamilie verlassen (${before.h.toFixed(1)}° -> ${after.h.toFixed(1)}°)`,
  )
}

// 3. Die Saettigung sinkt deutlich — das ist der ganze Zweck der Uebung. Der relative Abfall
//    ist der eigentliche Vertrag; 0.5 ist zusaetzlich die Grenze, ab der eine Farbe auf dem
//    dunklen Holz wieder zu leuchten anfaengt.
for (const [rank, hex] of Object.entries(RANK_COLORS)) {
  const before = toHsl(hex)
  const after = toHsl(patina(hex))
  assert.ok(after.s <= 0.5, `${rank}: immer noch knallig (s=${after.s.toFixed(2)})`)
  assert.ok(
    after.s <= before.s * 0.65,
    `${rank}: Saettigung kaum gesunken (${before.s.toFixed(2)} -> ${after.s.toFixed(2)})`,
  )
}

// 4. Die Helligkeit bleibt im Fenster: nicht im Holz absaufen, nicht pastellig leuchten.
for (const [rank, hex] of Object.entries(RANK_COLORS)) {
  const { l } = toHsl(patina(hex))
  assert.ok(l >= 0.30 && l <= 0.52, `${rank}: Helligkeit ausserhalb des Fensters (l=${l.toFixed(2)})`)
}

// 5. Die Raenge bleiben paarweise unterscheidbar. Das ist die eigentliche Grenze: Entsaettigen
//    und Untertoenen zieht alle Farben zueinander — zu weit, und der Donut wird eine Scheibe.
const rgb = (hex) => [1, 2, 3].map((i) => parseInt(hex.slice(i * 2 - 1, i * 2 + 1), 16))
const ranks = Object.entries(RANK_COLORS)
for (let i = 0; i < ranks.length; i += 1) {
  for (let j = i + 1; j < ranks.length; j += 1) {
    const a = rgb(patina(ranks[i][1]))
    const b = rgb(patina(ranks[j][1]))
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    assert.ok(
      dist >= 20,
      `${ranks[i][0]} und ${ranks[j][0]} sind verschmolzen (RGB-Abstand ${dist.toFixed(1)})`,
    )
  }
}

// 6. Muell kommt unveraendert zurueck statt zu crashen (die API liefert theoretisch alles).
assert.equal(patina('nope'), 'nope')
assert.equal(patina(''), '')
assert.equal(patina(undefined), undefined)

// 7. hslToHex an den Ecken.
assert.equal(hslToHex(0, 0, 0), '#000000')
assert.equal(hslToHex(0, 0, 1), '#ffffff')
assert.equal(hslToHex(0, 1, 0.5), '#ff0000')

console.log('patina: alle Checks gruen')
for (const [rank, hex] of Object.entries(RANK_COLORS)) {
  console.log(`  ${rank.padEnd(10)} ${hex} -> ${patina(hex)}`)
}
