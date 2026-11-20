// Generates symbol-styles-comparison.html: one process, drawn three ways from one layout.
//   node docs/experiments/build-symbol-styles-comparison.mjs docs/experiments/symbol-styles-comparison.html
// With SURVEY_ENDPOINT=<the Apps Script web app address> in the environment the page is built to send its
// answers there; leave it out for the copy kept in the repo, since anyone who has the address can add rows.
import { writeFileSync } from 'node:fs'
import {
  STENCIL_MARK_PATHS,
  STENCIL_MARK_SOLID,
  stencilMarkScale,
  arrowBandPath,
  ARROW_BAND
} from '../../src/shared/stencils/kinds.ts'

const W = 1400
// The treating doctor and the coordinating nurse need the room: notes, labels and the parallel rows.
const LH = [150, 240, 280, 170]
const LTOP = LH.map((_, i) => LH.slice(0, i).reduce((a, b) => a + b, 0))
const H = LH.reduce((a, b) => a + b, 0)
const STRIP = 40
const lanes = ['Patient / Family', 'Treating doctor', 'Coordinating nurse', 'Coordinating doctor']
const LY = (i) => LTOP[i] + LH[i] / 2

// ---- the process (one layout for all three styles) -------------------------------------------
// t: start, message, end, gate (g: xor | par), human, auto, sub, step. An end has an outcome and a reach.
const STEP = { w: 156, h: 64 }
const GATE = 48
const EV = 40
const nodes = {
  S1: { t: 'start', x: 100, y: LY(0) },
  T1: { t: 'human', x: 240, y: LY(0), label: 'Request for homecare' },
  S2: { t: 'start', x: 100, y: LY(1) },
  T2: { t: 'human', x: 240, y: LY(1), label: 'Diagnose disease' },
  T3: { t: 'human', x: 440, y: LY(1), label: 'Give a collective decision' },
  G1: { t: 'gate', g: 'xor', x: 586, y: LY(1), label: 'Is the decision at home?', pos: 'above' },
  T4: { t: 'human', x: 758, y: LY(1), label: 'Send patient to hospital' },
  E1: { t: 'end', x: 900, y: LY(1), label: 'Referred' },
  T5: { t: 'human', x: 240, y: LY(2), label: 'Obtain patient agreement' },
  GA: { t: 'gate', g: 'xor', x: 386, y: LY(2), label: 'Patient agrees?', pos: 'above' },
  E4: { t: 'end', x: 386, y: LY(2) + 92, outcome: 'aborted', reach: 'flow', label: 'Request withdrawn' },
  G3: { t: 'gate', g: 'par', x: 494, y: LY(2) },
  M1: { t: 'message', x: 582, y: LY(2), label: 'Doctors notified' },
  T6: { t: 'human', x: 724, y: LY(2), label: 'Obtain agreement of doctors' },
  G4: { t: 'gate', g: 'xor', x: 870, y: LY(2), label: 'Agreed?', pos: 'above' },
  E3: { t: 'end', x: 870, y: LY(2) + 92, outcome: 'failed', label: 'Not admitted' },
  P1: { t: 'gate', g: 'par', x: 978, y: LY(2) },
  T7: { t: 'human', x: 1124, y: LY(2) - 62, label: 'Admit patient in home healthcare' },
  T9: { t: 'auto', x: 1124, y: LY(2) + 62, label: 'Send notice to the family' },
  P2: { t: 'gate', g: 'par', x: 1262, y: LY(2) },
  E2: { t: 'end', x: 1350, y: LY(2), label: 'Admitted' },
  M0: { t: 'message', x: 190, y: LY(3), label: 'Request received' },
  T8: { t: 'sub', x: 494, y: LY(3), label: 'Formalize administrative request' }
}
const isStep = (n) => n.t === 'human' || n.t === 'step' || n.t === 'auto' || n.t === 'sub'
const half = (n) =>
  isStep(n) ? { hw: STEP.w / 2, hh: STEP.h / 2 } : n.t === 'gate' ? { hw: GATE / 2, hh: GATE / 2 } : { hw: EV / 2, hh: EV / 2 }
const at = (id, side) => {
  const n = nodes[id]
  const { hw, hh } = half(n)
  return {
    left: [n.x - hw, n.y],
    right: [n.x + hw, n.y],
    top: [n.x, n.y - hh],
    bottom: [n.x, n.y + hh]
  }[side]
}
const YES_Y = LTOP[1] + 222 // the horizontal run of the "yes" line from the first choice, under the note of T2
const edges = [
  { p: [at('S1', 'right'), at('T1', 'left')] },
  { p: [at('T1', 'bottom'), [240, 134], [56, 134], [56, LY(3)], at('M0', 'left')] },
  { p: [at('S2', 'right'), at('T2', 'left')] },
  { p: [at('T2', 'right'), at('T3', 'left')] },
  { p: [at('T3', 'right'), at('G1', 'left')] },
  { p: [at('G1', 'right'), at('T4', 'left')], label: 'No', lx: 645, ly: LY(1) },
  { p: [at('G1', 'bottom'), [586, YES_Y], [240, YES_Y], at('T5', 'top')], label: 'Yes', lx: 586, ly: 335 },
  { p: [at('T4', 'right'), at('E1', 'left')] },
  { p: [at('T5', 'right'), at('GA', 'left')] },
  { p: [at('GA', 'right'), at('G3', 'left')], label: 'Yes', lx: 440, ly: LY(2) },
  { p: [at('GA', 'bottom'), at('E4', 'top')], label: 'No', lx: 386, ly: LY(2) + 46 },
  { p: [at('M0', 'right'), at('T8', 'left')] },
  { p: [at('T8', 'top'), at('G3', 'bottom')] },
  { p: [at('G3', 'right'), at('M1', 'left')] },
  { p: [at('M1', 'right'), at('T6', 'left')] },
  { p: [at('T6', 'right'), at('G4', 'left')] },
  { p: [at('G4', 'right'), at('P1', 'left')], label: 'Yes', lx: 924, ly: LY(2) },
  { p: [at('G4', 'bottom'), at('E3', 'top')], label: 'No', lx: 870, ly: LY(2) + 46 },
  { p: [at('P1', 'top'), [978, LY(2) - 62], at('T7', 'left')] },
  { p: [at('P1', 'bottom'), [978, LY(2) + 62], at('T9', 'left')] },
  { p: [at('T7', 'right'), [1262, LY(2) - 62], at('P2', 'top')] },
  { p: [at('T9', 'right'), [1262, LY(2) + 62], at('P2', 'bottom')] },
  { p: [at('P2', 'right'), at('E2', 'left')] }
]
// Notes: `right` ones sit beside the element, `below` ones under it; the dashed line meets the text in
// the middle (of its height beside, of its width below).
const notes = [
  { kind: 'right', lines: ['A signed request from the patient', 'or his family is needed'], ax: 318, ay: LY(0), x: 346, y: LY(0) },
  { kind: 'below', lines: ['The treatment mode is proposed after', 'a dialog between specialists'], ax: 240, ay: LY(1) + 32, y: LY(1) + 70 },
  { kind: 'below', lines: ['Agreement of the patient', 'is necessary'], ax: 240, ay: LY(2) + 32, y: LY(2) + 70 }
]

// The marks of the symbol set from before the new ones, which are not in the kinds table any more
// (git 72c90f1~1): used for the minimalist drawing. All are stroked, none solid.
const OLD_MARKS = {
  cross: 'M6 6L18 18M6 18L18 6',
  plus: 'M5 12H19M12 5V19',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  'sub-flow': 'M5 5h14v14H5zM12 8.5v7M8.5 12h7'
}

// ---- helpers ---------------------------------------------------------------------------------
const num = (n) => Math.round(n * 100) / 100
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const CH = 6.1 // average glyph width at 12px
function wrap(text, maxWidth, size = 12) {
  const per = CH * (size / 12)
  const words = text.split(' ')
  const out = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length * per > maxWidth && line) {
      out.push(line)
      line = w
    } else line = next
  }
  if (line) out.push(line)
  return out
}
function textBlock(lines, cx, cy, size = 12, cls = 't', anchor = 'middle') {
  const lh = size * 1.25
  const top = cy - ((lines.length - 1) * lh) / 2
  return (
    `<text class="${cls}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="central">` +
    lines.map((l, i) => `<tspan x="${num(cx)}" y="${num(top + i * lh)}">${esc(l)}</tspan>`).join('') +
    `</text>`
  )
}
function mark(name, x, y, size, paint, line = 2, set = null) {
  const paths = set ?? STENCIL_MARK_PATHS
  const s = (size / 24) * (set ? 1 : stencilMarkScale(name))
  const off = (size - 24 * s) / 2
  const solid = !set && STENCIL_MARK_SOLID.has(name)
  return (
    `<g transform="translate(${num(x + off)} ${num(y + off)}) scale(${num(s)})">` +
    `<path d="${paths[name]}" fill="${solid ? paint : 'none'}" stroke="${paint}" stroke-width="${num(line)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  )
}
const labelBelow = (n, size = 11) => {
  if (!n.label) return ''
  const lines = wrap(n.label, n.t === 'gate' ? 90 : 120, size)
  const cy = n.pos === 'above' ? n.y - half(n).hh - 9 - (lines.length - 1) * size * 0.625 : n.y + half(n).hh + 12
  return textBlock(lines, n.x, cy, size)
}
const evLabel = labelBelow

// ---- edges (the same lines in all three styles; the arrow colour differs) --------------------
function edgeSvg(e, stroke, arrow, chip) {
  const d = e.p.map((p, i) => `${i ? 'L' : 'M'}${num(p[0])} ${num(p[1])}`).join('')
  // arrow head at the end, pointing along the last segment
  const [a, b] = [e.p[e.p.length - 2], e.p[e.p.length - 1]]
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const L = 10
  const Wd = 4.5
  const p1 = [b[0] - L * Math.cos(ang) + Wd * Math.sin(ang), b[1] - L * Math.sin(ang) - Wd * Math.cos(ang)]
  const p2 = [b[0] - L * Math.cos(ang) - Wd * Math.sin(ang), b[1] - L * Math.sin(ang) + Wd * Math.cos(ang)]
  const line = `<path d="${d}" fill="none" stroke="var(${stroke})" stroke-width="1.6" stroke-linejoin="round"/>`
  const head = `<path d="M${num(b[0])} ${num(b[1])}L${num(p1[0])} ${num(p1[1])}L${num(p2[0])} ${num(p2[1])}Z" fill="var(${arrow})"/>`
  let label = ''
  if (e.label) {
    const w = e.label.length * 6.6 + 12
    label =
      (chip
        ? `<rect x="${num(e.lx - w / 2)}" y="${num(e.ly - 9)}" width="${num(w)}" height="18" rx="4" fill="var(--chip)" stroke="var(--lane-line)"/>`
        : `<rect x="${num(e.lx - w / 2)}" y="${num(e.ly - 8)}" width="${num(w)}" height="16" fill="var(--bg-d)"/>`) +
      `<text class="t" font-size="11" text-anchor="middle" x="${num(e.lx)}" y="${num(e.ly)}" dominant-baseline="central">${e.label}</text>`
  }
  return line + head + label
}

// ---- style A: BPMN 2.0 -----------------------------------------------------------------------
function styleA() {
  const out = []
  const S = 'stroke="var(--bp-stroke)"'
  // pool with lanes
  out.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="var(--bp-fill)" ${S} stroke-width="1.5"/>`)
  lanes.forEach((name, i) => {
    out.push(`<rect x="1" y="${LTOP[i] + 1}" width="${STRIP}" height="${LH[i] - 2}" fill="none" ${S} stroke-width="1.5"/>`)
    if (i) out.push(`<line x1="${STRIP}" y1="${LTOP[i]}" x2="${W - 1}" y2="${LTOP[i]}" ${S} stroke-width="1.5"/>`)
    out.push(
      `<text class="t" font-size="13" text-anchor="middle" dominant-baseline="central" transform="translate(${STRIP / 2 + 1} ${LY(i)}) rotate(-90)">${name}</text>`
    )
  })
  edges.forEach((e) => out.push(edgeSvg(e, '--bp-stroke', '--bp-stroke', false)))
  for (const n of Object.values(nodes)) {
    const { x, y } = n
    if (isStep(n)) {
      const lx = x - STEP.w / 2
      const ty = y - STEP.h / 2
      out.push(`<rect x="${lx}" y="${ty}" width="${STEP.w}" height="${STEP.h}" rx="10" fill="var(--bp-fill)" ${S} stroke-width="1.5"/>`)
      let dy = 0
      if (n.t === 'human') {
        // user task marker: a head and shoulders, top left
        const ix = lx + 12
        const iy = ty + 11
        out.push(
          `<circle cx="${ix + 4}" cy="${iy + 2}" r="3" fill="none" ${S} stroke-width="1.2"/>` +
            `<path d="M${ix - 1} ${iy + 12}v-3.5a5 5 0 0 1 10 0v3.5z" fill="none" ${S} stroke-width="1.2"/>`
        )
        dy = 4
      } else if (n.t === 'auto') {
        // service task marker: a gear, top left
        out.push(mark('gear', lx + 8, ty + 6, 18, 'var(--bp-stroke)', 1.5, OLD_MARKS))
        dy = 4
      } else if (n.t === 'sub') {
        // collapsed sub-process marker: a small square with a plus, bottom centre
        out.push(
          `<rect x="${x - 7}" y="${ty + STEP.h - 18}" width="14" height="14" fill="none" ${S} stroke-width="1.2"/>` +
            `<path d="M${x - 4} ${ty + STEP.h - 11}h8M${x} ${ty + STEP.h - 15}v8" fill="none" ${S} stroke-width="1.2"/>`
        )
        dy = -6
      }
      out.push(textBlock(wrap(n.label, dy > 0 ? STEP.w - 48 : STEP.w - 20), x + (dy > 0 ? 8 : 0), y + (dy > 0 ? 6 : dy), 12))
    } else if (n.t === 'gate') {
      const r = GATE / 2
      out.push(`<path d="M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z" fill="var(--bp-fill)" ${S} stroke-width="1.5"/>`)
      const k = n.g === 'par' ? 11 : 9
      out.push(
        n.g === 'par'
          ? `<path d="M${x - k} ${y}H${x + k}M${x} ${y - k}V${y + k}" ${S} stroke-width="3.2" fill="none"/>`
          : `<path d="M${x - k} ${y - k}L${x + k} ${y + k}M${x - k} ${y + k}L${x + k} ${y - k}" ${S} stroke-width="3.2" fill="none"/>`
      )
      out.push(labelBelow(n))
    } else {
      const r = EV / 2 - 2
      const heavy = n.t === 'end'
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="var(--bp-fill)" ${S} stroke-width="${heavy ? 4 : 1.5}"/>`)
      if (n.t === 'message') {
        out.push(`<circle cx="${x}" cy="${y}" r="${r - 3.5}" fill="none" ${S} stroke-width="1.5"/>`)
        out.push(
          `<rect x="${x - 8}" y="${y - 5.5}" width="16" height="11" fill="none" ${S} stroke-width="1.3"/>` +
            `<path d="M${x - 8} ${y - 5.5}L${x} ${y + 1}L${x + 8} ${y - 5.5}" fill="none" ${S} stroke-width="1.3"/>`
        )
      }
      if (heavy && n.reach === 'flow') {
        // terminate end event: a solid disc inside the ring
        out.push(`<circle cx="${x}" cy="${y}" r="${r - 6}" fill="var(--bp-stroke)"/>`)
      } else if (heavy && n.outcome === 'failed') {
        // error end event: a lightning bolt
        out.push(`<path d="M${x - 6} ${y + 7}L${x - 2} ${y - 3}L${x + 2} ${y + 2}L${x + 6} ${y - 8}" fill="none" ${S} stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`)
      }
      out.push(evLabel(n))
    }
  }
  notes.forEach((n) => out.push(noteBpmn(n)))
  return out.join('')
}
function noteBpmn(n) {
  const h = n.lines.length * 15 + 6
  const w = Math.max(...n.lines.map((l) => l.length)) * 5.8 + 14
  const x0 = n.kind === 'right' ? n.x : n.ax - w / 2
  const top = n.y - h / 2
  const target = n.kind === 'right' ? [x0, n.y] : [x0, top]
  return (
    `<path d="M${x0 + 8} ${top}H${x0}V${top + h}H${x0 + 8}" fill="none" stroke="var(--bp-stroke)" stroke-width="1.2"/>` +
    textBlock(n.lines, x0 + 12, n.y, 11, 't', 'start') +
    `<path d="M${n.ax} ${n.ay}L${target[0]} ${target[1]}" stroke="var(--bp-stroke)" stroke-width="1.1" stroke-dasharray="2 3" fill="none"/>`
  )
}

// ---- lanes of B and C (the app's containers) ---------------------------------------------------
function appLanes() {
  const out = []
  lanes.forEach((name, i) => {
    out.push(`<rect x="1" y="${LTOP[i] + 3}" width="${W - 2}" height="${LH[i] - 6}" rx="8" fill="var(--lane)" stroke="var(--lane-line)" stroke-width="1.2"/>`)
    out.push(
      `<text class="t" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="central" transform="translate(18 ${LY(i)}) rotate(-90)">${name}</text>`
    )
  })
  return out.join('')
}
// The dashed line meets the text in the middle: of its height beside it, of its width below it.
function noteApp(n) {
  const dash = (x1, y1, x2, y2) =>
    `<path d="M${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}" stroke="var(--muted)" stroke-width="1.1" stroke-dasharray="2 3" fill="none"/>`
  const h = n.lines.length * 13.75
  return n.kind === 'right'
    ? dash(n.ax, n.ay, n.x - 5, n.y) + textBlock(n.lines, n.x, n.y, 11, 'tm', 'start')
    : dash(n.ax, n.ay, n.ax, n.y - h / 2 - 4) + textBlock(n.lines, n.ax, n.y, 11, 'tm', 'middle')
}

// ---- style C: the CHD symbols; B (old): the symbol set from before them ---------------------------
function styleApp(old) {
  const out = [appLanes()]
  edges.forEach((e) => out.push(edgeSvg(e, '--edge', '--edge', true)))
  for (const n of Object.values(nodes)) {
    const { x, y } = n
    if (isStep(n)) {
      const lx = x - STEP.w / 2
      const ty = y - STEP.h / 2
      const sw = 2
      const i = sw / 2
      out.push(`<rect x="${lx + i}" y="${ty + i}" width="${STEP.w - sw}" height="${STEP.h - sw}" rx="4" fill="var(--step-fill)" stroke="var(--step-stroke)" stroke-width="${sw}"/>`)
      out.push(`<path d="${arrowBandPath(lx + i, ty + i, ty + STEP.h - i, 4, 1)}" fill="var(--step-stroke)"/>`)
      const name = { human: 'person', auto: old ? 'gear' : 'robot', sub: old ? 'sub-flow' : 'layers' }[n.t]
      // the mark sits in the bottom right corner
      if (name) out.push(mark(name, lx + STEP.w - 9 - 18, ty + STEP.h - 9 - 18, 18, 'var(--text)', 2, old && n.t !== 'human' ? OLD_MARKS : null))
      const left = ARROW_BAND.tip
      const right = name ? 28 : 0
      out.push(textBlock(wrap(n.label, STEP.w - left - right - 6), lx + left + (STEP.w - left - right) / 2, y, 12))
    } else if (n.t === 'gate') {
      const r = GATE / 2
      out.push(`<rect x="${x - r + 1}" y="${y - r + 1}" width="${GATE - 2}" height="${GATE - 2}" rx="4" fill="var(--choice-fill)" stroke="var(--choice-stroke)" stroke-width="2"/>`)
      const name = n.g === 'par' ? (old ? 'plus' : 'bars') : old ? 'cross' : 'fork'
      const size = GATE * 0.46
      out.push(mark(name, x - size / 2, y - size / 2, size, 'var(--text)', 2, old ? OLD_MARKS : null))
      out.push(labelBelow(n))
    } else {
      const heavy = n.t === 'end'
      // an end that stops the whole flow is the same heavy ring around a darker centre with a light mark (the old set has no outcomes)
      const solid = !old && heavy && n.reach === 'flow'
      const sw = heavy ? 5 : 2
      const r = EV / 2 - sw / 2
      out.push(`<circle cx="${x}" cy="${y}" r="${num(r)}" fill="${solid ? 'var(--event-solid)' : 'var(--event-fill)'}" stroke="var(--event-stroke)" stroke-width="${sw}"/>`)
      const doubled = n.t === 'message'
      if (doubled) out.push(`<circle cx="${x}" cy="${y}" r="${num(r - sw - 3)}" fill="none" stroke="var(--event-stroke)" stroke-width="${sw}"/>`)
      const mk = n.t === 'start' ? 'play' : n.t === 'end' ? { success: 'check', failed: 'cross', aborted: 'stop' }[n.outcome ?? 'success'] : 'envelope'
      const size = EV * (doubled ? 0.42 : solid ? 0.5 : 0.46)
      // the set before the new marks: a start and an end carry none
      if (!(old && (n.t === 'start' || n.t === 'end'))) out.push(mark(mk, x - size / 2, y - size / 2, size, solid ? 'var(--event-solid-mark)' : 'var(--text)'))
      out.push(evLabel(n))
    }
  }
  notes.forEach((n) => out.push(noteApp(n)))
  return out.join('')
}

const svg = (body) =>
  `<svg viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
const A = svg(styleA())
const B = svg(styleApp(true))
const C = svg(styleApp(false))

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>One process, three drawings</title>
<!--
  A comparison stimulus for the symbol styles: the same home healthcare process drawn three ways, from
  one layout, so only the symbols differ; a colour vision toggle shows how each reads without full colour. The styles are not named on the page, on purpose. Nothing here
  is wired into the app; open the file in a browser. Generated; the process is a redrawing of a published
  process map, not a copy of its figure.
-->
<style>
  :root {
    color-scheme: light;
    --bg: #f4f5f8; --text: #1d1f27; --muted: #5b6070; --panel: #ffffff; --line: #d3d6e0; --accent: #3b6e77;
    --lane: #eceef4; --lane-line: #c4c8d6; --edge: #5b6070; --chip: #ffffff; --bg-d: #ffffff;
    --bp-stroke: #1a1a1a; --bp-fill: #ffffff;
    --step-fill: #a5c8ce; --step-stroke: #3b6e77; --choice-fill: #f7edd6; --choice-stroke: #8a7a4a;
    --event-fill: #8f96e2; --event-stroke: #4f537c;
    --event-solid: #3a3e6e; --event-solid-mark: #e6e8fb;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      color-scheme: dark;
      --bg: #15161c; --text: #e6e7ee; --muted: #9a9eb0; --panel: #1c1e27; --line: #333649; --accent: #4e939e;
      --lane: #1f212b; --lane-line: #3a3e52; --edge: #8d93a8; --chip: #1c1e27; --bg-d: #1c1e27;
      --bp-stroke: #e6e7ee; --bp-fill: #1c1e27;
      --step-fill: #345a60; --step-stroke: #4e939e; --choice-fill: #97782d; --choice-stroke: #c9a449;
      --event-fill: #2f3141; --event-stroke: #c1c5ef;
      --event-solid: #14151c; --event-solid-mark: #c1c5ef;
    }
  }
  :root[data-theme='dark'] {
    color-scheme: dark;
    --bg: #15161c; --text: #e6e7ee; --muted: #9a9eb0; --panel: #1c1e27; --line: #333649; --accent: #4e939e;
    --lane: #1f212b; --lane-line: #3a3e52; --edge: #8d93a8; --chip: #1c1e27; --bg-d: #1c1e27;
    --bp-stroke: #e6e7ee; --bp-fill: #1c1e27;
    --step-fill: #345a60; --step-stroke: #4e939e; --choice-fill: #97782d; --choice-stroke: #c9a449;
    --event-fill: #2f3141; --event-stroke: #c1c5ef;
      --event-solid: #14151c; --event-solid-mark: #c1c5ef;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, 'Segoe UI', sans-serif; }
  header { position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; }
  header h1 { font-size: 15px; margin: 0 6px 0 0; font-weight: 600; }
  .group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .group > span { color: var(--muted); font-size: 12px; margin-right: 2px; }
  button { font: inherit; font-size: 13px; color: var(--text); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 4px 12px; cursor: pointer; }
  button[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  main { padding: 16px; max-width: 1440px; margin: 0 auto; }
  .sheet { display: grid; gap: 22px; }
  .sheet[data-view='side'] { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .sheet[data-view='A'] figure:not([data-id='A']),
  .sheet[data-view='B'] figure:not([data-id='B']),
  .sheet[data-view='C'] figure:not([data-id='C']) { display: none; }
  figure { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px 12px; }
  figcaption { font-size: 22px; font-weight: 700; margin: 0 0 6px 2px; letter-spacing: .02em; }
  figure svg { display: block; width: 100%; height: auto; }
  svg .t { fill: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; }
  .sheet[data-vision='prot'] figure svg { filter: url(#cv-prot); }
  .sheet[data-vision='deut'] figure svg { filter: url(#cv-deut); }
  .sheet[data-vision='trit'] figure svg { filter: url(#cv-trit); }
  .sheet[data-vision='grey'] figure svg { filter: url(#cv-grey); }
  [hidden] { display: none !important; }
  .survey { margin-top: 28px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px 20px; max-width: 760px; }
  .survey h2 { font-size: 18px; margin: 0 0 4px; }
  .survey .lead { color: var(--muted); margin: 0 0 18px; font-size: 13px; }
  .survey fieldset { border: 0; padding: 0; margin: 0 0 22px; }
  .survey legend { font-weight: 600; padding: 0; margin-bottom: 2px; }
  .survey .hint { color: var(--muted); font-size: 12px; margin: 0 0 8px; }
  .survey .row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 28px; align-items: center; gap: 10px; padding: 4px 0; }
  .survey .row b { font-size: 18px; }
  .survey .row output { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
  .survey .row[data-touched='true'] output { color: var(--text); font-weight: 600; }
  .survey input[type='range'] { width: 100%; accent-color: var(--accent); margin: 0; }
  .survey .row[data-touched='false'] input[type='range'] { opacity: .5; }
  .survey .ticks { display: grid; grid-template-columns: 28px minmax(0, 1fr) 28px; gap: 10px; color: var(--muted); font-size: 11px; }
  .survey .ticks span { display: flex; justify-content: space-between; }
  .survey .ticks i { font-style: normal; }
  .survey select { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; max-width: 100%; }
  .survey textarea { width: 100%; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px; min-height: 84px; resize: vertical; }
  .survey .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .survey .send { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .survey #status { font-size: 13px; color: var(--muted); }
  .survey #status[data-kind='error'] { color: #c0392b; }
  .survey .done { font-weight: 600; }
  svg .tm { fill: var(--muted); font-family: 'Segoe UI', system-ui, sans-serif; font-style: italic; }
  @media (max-width: 700px) { .sheet[data-view='side'] { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>One process, three drawings</h1>
  <div class="group" id="views"><span>Show</span>
    <button data-view="all" aria-pressed="true">A, B and C</button>
    <button data-view="side" aria-pressed="false">Side by side</button>
    <button data-view="A" aria-pressed="false">A</button>
    <button data-view="B" aria-pressed="false">B</button>
    <button data-view="C" aria-pressed="false">C</button>
  </div>
  <div class="group" id="vision"><span>Colour vision</span>
    <button data-vision="normal" aria-pressed="true">Normal</button>
    <button data-vision="prot" aria-pressed="false" title="No working red cones">Protanopia</button>
    <button data-vision="deut" aria-pressed="false" title="No working green cones">Deuteranopia</button>
    <button data-vision="trit" aria-pressed="false" title="No working blue cones">Tritanopia</button>
    <button data-vision="grey" aria-pressed="false" title="No colour at all, as in a black and white print">Greyscale</button>
  </div>
  <div class="group" id="themes"><span>Theme</span>
    <button data-theme-set="light" aria-pressed="false">Light</button>
    <button data-theme-set="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="cv-prot" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0"/></filter>
    <filter id="cv-deut" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"/></filter>
    <filter id="cv-trit" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0"/></filter>
    <filter id="cv-grey" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/></filter>
  </defs>
</svg>
<main>
  <div class="sheet" id="sheet" data-view="all" data-vision="normal">
    <figure data-id="A" data-style="bpmn"><figcaption>A</figcaption>${A}</figure>
    <figure data-id="B" data-style="min"><figcaption>B</figcaption>${B}</figure>
    <figure data-id="C" data-style="chd"><figcaption>C</figcaption>${C}</figure>
  </div>
  <section id="first" class="survey" lang="nb" aria-labelledby="first-h">
    <h2 id="first-h">Første inntrykk</h2>
    <p class="lead">Se på de tre diagrammene over (A, B og C) og svar spontant. Svaret kan ikke endres etterpå.</p>
    <fieldset data-q="welcoming">
      <legend>Hvor visuelt velkommende var diagrammet?</legend>
      <p class="hint">Den øyeblikkelige reaksjonen du hadde til diagrammet. 1 = ikke velkommende, 5 = svært velkommende</p>
      <div class="row" data-touched="false"><b>A</b><input type="range" min="1" max="5" step="1" value="3" name="welcoming-A" aria-label="Velkommende, diagram A"><output>–</output></div>
      <div class="row" data-touched="false"><b>B</b><input type="range" min="1" max="5" step="1" value="3" name="welcoming-B" aria-label="Velkommende, diagram B"><output>–</output></div>
      <div class="row" data-touched="false"><b>C</b><input type="range" min="1" max="5" step="1" value="3" name="welcoming-C" aria-label="Velkommende, diagram C"><output>–</output></div>
      <div class="ticks"><i></i><span><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i></span><i></i></div>
    </fieldset>
    <div class="send"><button type="button" id="go">Fortsett</button><span id="first-status" role="status" aria-live="polite"></span></div>
  </section>
  <section id="survey" class="survey" lang="nb" hidden aria-labelledby="survey-h">
    <h2 id="survey-h">Spørreundersøkelse</h2>
    <p class="lead">Svar for alle tre (A, B og C). Svarene er anonyme.</p>
    <form id="survey-form" novalidate>
      <fieldset data-q="easy">
        <legend>Hvor enkel var diagrammet å lese?</legend>
        <p class="hint">1 = veldig vanskelig, 5 = veldig enkel</p>
        <div class="row" data-touched="false"><b>A</b><input type="range" min="1" max="5" step="1" value="3" name="easy-A" aria-label="Enkelhet, diagram A"><output>–</output></div>
        <div class="row" data-touched="false"><b>B</b><input type="range" min="1" max="5" step="1" value="3" name="easy-B" aria-label="Enkelhet, diagram B"><output>–</output></div>
        <div class="row" data-touched="false"><b>C</b><input type="range" min="1" max="5" step="1" value="3" name="easy-C" aria-label="Enkelhet, diagram C"><output>–</output></div>
        <div class="ticks"><i></i><span><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i></span><i></i></div>
      </fieldset>
      <fieldset>
        <legend><label for="bpmn">Hvor godt kjent er du med BPMN?</label></legend>
        <select id="bpmn" name="bpmn" required>
          <option value="" selected disabled>Velg …</option>
          <option value="0">Ukjent</option>
          <option value="1">Har hørt om det</option>
          <option value="2">Har vært borti det</option>
          <option value="3">Har brukt det en del</option>
          <option value="4">Har dyp og lang erfaring</option>
        </select>
      </fieldset>
      <fieldset>
        <legend><label for="comment">Tilleggskommentarer (valgfritt)</label></legend>
        <p class="hint">Ikke skriv navn eller andre personopplysninger.</p>
        <textarea id="comment" name="comment" maxlength="1000" rows="3"></textarea>
      </fieldset>
      <div class="hp" aria-hidden="true"><label>Nettside <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="send"><button type="submit" id="send">Send inn</button><span id="status" role="status" aria-live="polite"></span></div>
    </form>
  </section>
</main>
<script>
  const root = document.documentElement
  const sheet = document.getElementById('sheet')
  const press = (group, attr, value) =>
    document.querySelectorAll('#' + group + ' button').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)))
  const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  const syncTheme = () => press('themes', 'data-theme-set', dark() ? 'dark' : 'light')
  document.getElementById('views').addEventListener('click', (e) => {
    const v = e.target.closest('button')?.dataset.view
    if (!v) return
    sheet.dataset.view = v
    document.querySelector('main').style.maxWidth = v === 'side' ? 'none' : ''
    press('views', 'data-view', v)
  })
  document.getElementById('vision').addEventListener('click', (e) => {
    const v = e.target.closest('button')?.dataset.vision
    if (!v) return
    sheet.dataset.vision = v
    press('vision', 'data-vision', v)
  })
  document.getElementById('themes').addEventListener('click', (e) => {
    const t = e.target.closest('button')?.dataset.themeSet
    if (!t) return
    root.dataset.theme = t
    syncTheme()
  })
  syncTheme()

  // ---- the survey: one row per submission is written to a Google Sheet by an Apps Script web app
  // (see symbol-styles-survey-endpoint.gs). Empty here on purpose: the address is not kept in the repo.
  const SURVEY_ENDPOINT = '__SURVEY_ENDPOINT__'
  const SURVEY_ROUND = 'symbols-3'

  // Which style each letter shows is shuffled for every visitor, and kept for the visit. The figures are
  // written in the order bpmn, min, chd; #order=chd,bpmn,min in the address fixes the order (for a look at
  // the page without the shuffle).
  const STYLE_KEYS = ['bpmn', 'min', 'chd']
  const validOrder = (o) => Array.isArray(o) && o.length === 3 && STYLE_KEYS.every((k) => o.includes(k))
  let order = null
  const fromHash = /order=([a-z,]+)/.exec(location.hash)
  if (fromHash && validOrder(fromHash[1].split(','))) order = fromHash[1].split(',')
  if (!order) {
    try { const saved = JSON.parse(sessionStorage.getItem('symbol-order')); if (validOrder(saved)) order = saved } catch (e) {}
  }
  if (!order) {
    order = STYLE_KEYS.slice()
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    try { sessionStorage.setItem('symbol-order', JSON.stringify(order)) } catch (e) {}
  }
  order.forEach((style, i) => {
    const fig = sheet.querySelector('figure[data-style="' + style + '"]')
    fig.dataset.id = 'ABC'[i]
    fig.querySelector('figcaption').textContent = 'ABC'[i]
    sheet.appendChild(fig)
  })

  const say = (el, text, kind) => { el.textContent = text; el.dataset.kind = kind || '' }
  // a slider counts as answered once the person has touched it, so an untouched 3 is not sent
  document.querySelectorAll('.survey .row').forEach((row) => {
    const input = row.querySelector('input')
    const out = row.querySelector('output')
    const touch = () => { row.dataset.touched = 'true'; out.textContent = input.value }
    input.addEventListener('input', touch)
    input.addEventListener('change', touch)
    input.addEventListener('pointerdown', touch)
  })
  const rating = (q) =>
    ['A', 'B', 'C'].map((k) => {
      const input = document.querySelector('[name="' + q + '-' + k + '"]')
      return input.closest('.row').dataset.touched === 'true' ? Number(input.value) : null
    })
  // by style, whatever letter the visitor saw it under
  const byStyle = (values) => {
    const o = {}
    order.forEach((style, i) => { o[style] = values[i] })
    return o
  }

  let welcoming = null
  document.getElementById('go').addEventListener('click', () => {
    const w = rating('welcoming')
    if (w.includes(null)) {
      say(document.getElementById('first-status'), 'Svar for alle tre først.', 'error')
      return
    }
    welcoming = w
    document.getElementById('first').hidden = true
    document.getElementById('survey').hidden = false
    document.getElementById('survey').scrollIntoView({ block: 'start' })
  })

  const form = document.getElementById('survey-form')
  const statusEl = document.getElementById('status')
  const sendBtn = document.getElementById('send')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const easy = rating('easy')
    const bpmn = form.elements.bpmn.value
    if (!welcoming || easy.includes(null) || bpmn === '') {
      say(statusEl, 'Svar på alle spørsmålene først.', 'error')
      return
    }
    sendBtn.disabled = true
    say(statusEl, 'Sender …')
    const payload = {
      round: SURVEY_ROUND,
      website: form.elements.website.value,
      order: order,
      welcoming: byStyle(welcoming),
      easy: byStyle(easy),
      bpmn: Number(bpmn),
      theme: dark() ? 'dark' : 'light',
      comment: form.elements.comment.value.trim().slice(0, 1000)
    }
    try {
      if (!SURVEY_ENDPOINT) throw new Error('no endpoint')
      // text/plain and no-cors: a simple request, no preflight, which Apps Script answers; the reply is opaque
      await fetch(SURVEY_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      form.querySelectorAll('input, select, textarea, button').forEach((el) => (el.disabled = true))
      say(statusEl, 'Takk for svaret!', 'done')
      statusEl.classList.add('done')
    } catch (err) {
      sendBtn.disabled = false
      say(statusEl, SURVEY_ENDPOINT ? 'Kunne ikke sende. Prøv igjen.' : 'Innsending er ikke satt opp ennå.', 'error')
    }
  })
</script>
</body>
</html>
`
const out = process.argv[2]
const endpoint = (process.env.SURVEY_ENDPOINT ?? '').replace(/[^A-Za-z0-9:/._?=&%-]/g, '')
writeFileSync(out, html.replace('__SURVEY_ENDPOINT__', endpoint))
console.log('written', out, html.length)
