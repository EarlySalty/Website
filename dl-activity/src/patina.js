// Die Rangfarben stammen aus dem Spiel (Fallback in activity.js) bzw. aus /api/rank-colors und
// sind bewusst neon — im Spiel muessen sie sich auf einen Blick unterscheiden. Auf der Gold/Holz-
// Seite reissen sie das Farbkonzept auseinander. `patina` daempft Saettigung und Helligkeit und
// legt einen gemeinsamen warmen Unterton darunter: Eternus bleibt gelb, aber als Messing;
// Ritualist bleibt blau, aber als Navy; Phantom bleibt rot, aber als Weinrot. Der Rang bleibt
// erkennbar, die Palette wird eine.

const CACHE = new Map()

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/** Maximale Saettigung nach der Behandlung — darueber wird jede Farbe wieder "knallig". */
const SAT_FACTOR = 0.6
const SAT_MAX = 0.48
/** Helligkeitsfenster: darunter sauft die Farbe im Holz ab, darueber leuchtet sie pastellig. */
const LIGHT_MIN = 0.34
const LIGHT_MAX = 0.48

/** Gemeinsamer warmer Unterton. Ein geteilter Grundton ist das, was aus elf Einzelfarben
 *  eine Palette macht — er zieht Blau nach Navy, Gruen nach Smaragd, Magenta nach Weinrot
 *  und Gelb nach Messing, ohne dass die Raenge ununterscheidbar werden. */
const TINT = [0xc8, 0xa8, 0x6b]
const TINT_MIX = 0.14

/**
 * Uebersetzt eine grelle In-Game-Rangfarbe in einen metallischen Ton derselben Familie.
 * Unbekannte Formate kommen unveraendert zurueck.
 */
export function patina(hex) {
  const cached = CACHE.get(hex)
  if (cached) return cached

  const m = HEX.exec(String(hex || '').trim())
  if (!m) return hex

  const [r, g, b] = m.slice(1).map((part) => parseInt(part, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta > 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / delta + 2) / 6
    else h = ((r - g) / delta + 4) / 6
  }

  const damped = hslToHex(
    h,
    Math.min(s * SAT_FACTOR, SAT_MAX),
    Math.min(Math.max(l, LIGHT_MIN), LIGHT_MAX),
  )
  const out = mix(damped, TINT, TINT_MIX)
  CACHE.set(hex, out)
  return out
}

/** Mischt eine Hex-Farbe anteilig mit einem RGB-Tripel. */
function mix(hex, [tr, tg, tb], amount) {
  const m = HEX.exec(hex)
  const [r, g, b] = m.slice(1).map((part) => parseInt(part, 16))
  const blend = (c, t) => Math.round(c * (1 - amount) + t * amount)
  return `#${[blend(r, tr), blend(g, tg), blend(b, tb)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

/** h/s/l jeweils 0..1 */
export function hslToHex(h, s, l) {
  const channel = (n) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}
