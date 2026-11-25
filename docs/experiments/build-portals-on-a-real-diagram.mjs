// Builds docs/experiments/portals-on-a-real-diagram.html: a mock-up of portals (epic 0205) on a real,
// messy diagram, the Meridian Rail landscape of the gallery. Nothing here is the app. Edges are drawn
// straight, as steps and as curves between their connection points, a portal is a short gap cut where an
// edge crosses another edge or an element, and the page compares the marks (tilde or oval) and the colour
// of a pair (one fixed light blue or one colour per pair), the line-hop alternative, setting a gap with
// two sliders and an Add portals button, and a portal point.
// Run: node docs/experiments/build-portals-on-a-real-diagram.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const source = join(root, 'examples', 'gallery', 'landscape', 'meridian-rail-landscape.chd')
const out = join(import.meta.dirname, 'portals-on-a-real-diagram.html')

const WINDOW = { w: 900, h: 560 }
const PORTALS = 6
const MARGIN = 24 // flow units kept clear on each side of what the gap skips
const MIN_GAP = 76 // the two marks and their numbers need this much room between them
const MIN_STUB = 44 // the visible edge kept at each element
const MAX_GAP = 340
const HOP = 6 // radius of a line hop

const diagram = JSON.parse(readFileSync(source, 'utf8'))
const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
const entities = diagram.nodes.filter((n) => (n.type ?? 'entity') === 'entity')

// --- geometry of the diagram

function rectOf(node) {
  let x = node.position.x
  let y = node.position.y
  for (let p = byId.get(node.parentId), hops = 0; p && hops < 50; p = byId.get(p.parentId), hops += 1) {
    x += p.position.x
    y += p.position.y
  }
  return { x, y, w: node.size?.width ?? 120, h: node.size?.height ?? 80 }
}
const rects = new Map(diagram.nodes.map((n) => [n.id, rectOf(n)]))

const NORMAL = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

// Where an edge meets an element: the stored connection point (the points of a side are spread
// evenly in the order of their offsets), or the middle of the side facing the other end.
function endpoint(node, handle, towards) {
  const r = rects.get(node.id)
  const points = node.connectionPoints ?? []
  const stored = points.find((p) => p.id === handle)
  let side
  let frac = 0.5
  if (stored) {
    side = stored.side
    const same = points.filter((p) => p.side === side).sort((a, b) => a.offset - b.offset)
    frac = (same.findIndex((p) => p.id === handle) + 1) / (same.length + 1)
  } else if (['top', 'right', 'bottom', 'left'].includes(handle)) {
    side = handle
  } else {
    const dx = towards.x - (r.x + r.w / 2)
    const dy = towards.y - (r.y + r.h / 2)
    side = Math.abs(dx) * r.h > Math.abs(dy) * r.w ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top'
  }
  if (side === 'top') return { x: r.x + frac * r.w, y: r.y, side }
  if (side === 'bottom') return { x: r.x + frac * r.w, y: r.y + r.h, side }
  if (side === 'left') return { x: r.x, y: r.y + frac * r.h, side }
  return { x: r.x + r.w, y: r.y + frac * r.h, side }
}
const centre = (n) => {
  const r = rects.get(n.id)
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

// An edge as a polyline: straight, a step with one bend in the middle, or a cubic curve (sampled).
function route(style, p, q) {
  if (style === 'straight') return [p, q]
  const ns = NORMAL[p.side]
  const nt = NORMAL[q.side]
  if (style === 'step') {
    if (ns.x !== 0 && nt.x !== 0) {
      const mx = (p.x + q.x) / 2
      return [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q]
    }
    if (ns.x === 0 && nt.x === 0) {
      const my = (p.y + q.y) / 2
      return [p, { x: p.x, y: my }, { x: q.x, y: my }, q]
    }
    return ns.x !== 0 ? [p, { x: q.x, y: p.y }, q] : [p, { x: p.x, y: q.y }, q]
  }
  const c = Math.min(200, Math.max(30, Math.hypot(q.x - p.x, q.y - p.y) * 0.4))
  const c1 = { x: p.x + ns.x * c, y: p.y + ns.y * c }
  const c2 = { x: q.x + nt.x * c, y: q.y + nt.y * c }
  const pts = []
  for (let i = 0; i <= 32; i += 1) {
    const t = i / 32
    const m = 1 - t
    pts.push({
      x: m ** 3 * p.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t ** 3 * q.x,
      y: m ** 3 * p.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t ** 3 * q.y
    })
  }
  return pts
}

function makePath(raw) {
  const pts = raw.filter((p, i) => i === 0 || Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y) > 0.01)
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, length: cum[cum.length - 1] }
}
// the point and unit direction at distance d along the path
function at(path, d) {
  const x = Math.min(Math.max(d, 0), path.length)
  let i = 1
  while (i < path.length - 1 && path.cum[i] < x) i += 1
  const a = path.pts[i - 1]
  const b = path.pts[i]
  const len = path.cum[i] - path.cum[i - 1] || 1
  const t = (x - path.cum[i - 1]) / len
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, u: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } }
}
// the stretch of the path between two distances, as points
function sub(path, d0, d1) {
  const pts = [at(path, d0)]
  for (let i = 0; i < path.pts.length; i += 1) if (path.cum[i] > d0 && path.cum[i] < d1) pts.push(path.pts[i])
  pts.push(at(path, d1))
  return pts
}

// where segment a-b crosses c-d, as the fraction along each, or null
function intersect(a, b, c, d) {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  return t > 0 && t < 1 && u > 0 && u < 1 ? { t, u } : null
}
// the stretch [t0, t1] of a-b inside a rectangle, or null
function through(a, b, r) {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  for (const [pos, delta, lo, hi] of [
    [a.x, dx, r.x, r.x + r.w],
    [a.y, dy, r.y, r.y + r.h]
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (pos < lo || pos > hi) return null
    } else {
      let s = (lo - pos) / delta
      let e = (hi - pos) / delta
      if (s > e) [s, e] = [e, s]
      t0 = Math.max(t0, s)
      t1 = Math.min(t1, e)
      if (t0 >= t1) return null
    }
  }
  return [t0, t1]
}

// --- one routing style: its edges, what each crosses, the busiest window and where to cut

function analyse(style) {
  const edges = []
  for (const e of diagram.edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (!s || !t) continue
    const path = makePath(route(style, endpoint(s, e.sourceHandle, centre(t)), endpoint(t, e.targetHandle, centre(s))))
    if (path.length > 1) edges.push({ id: e.id, source: e.source, target: e.target, path, length: path.length, index: edges.length })
  }
  const events = new Map(edges.map((e) => [e.id, []]))
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i]
      const b = edges[j]
      if ([a.source, a.target].some((id) => id === b.source || id === b.target)) continue
      for (let m = 1; m < a.path.pts.length; m += 1) {
        for (let n = 1; n < b.path.pts.length; n += 1) {
          const hit = intersect(a.path.pts[m - 1], a.path.pts[m], b.path.pts[n - 1], b.path.pts[n])
          if (!hit) continue
          const da = a.path.cum[m - 1] + hit.t * (a.path.cum[m] - a.path.cum[m - 1])
          const db = b.path.cum[n - 1] + hit.u * (b.path.cum[n] - b.path.cum[n - 1])
          events.get(a.id).push({ from: da, to: da, kind: 'edge', other: b.index })
          events.get(b.id).push({ from: db, to: db, kind: 'edge', other: a.index })
        }
      }
    }
  }
  for (const e of edges) {
    for (const n of entities) {
      if (n.id === e.source || n.id === e.target) continue
      for (let m = 1; m < e.path.pts.length; m += 1) {
        const stretch = through(e.path.pts[m - 1], e.path.pts[m], rects.get(n.id))
        if (!stretch) continue
        const base = e.path.cum[m - 1]
        const len = e.path.cum[m] - base
        if ((stretch[1] - stretch[0]) * len > 2) events.get(e.id).push({ from: base + stretch[0] * len, to: base + stretch[1] * len, kind: 'element' })
      }
    }
  }
  const inside = (w, pt) => pt.x >= w.x && pt.x <= w.x + w.w && pt.y >= w.y && pt.y <= w.y + w.h
  const rs = entities.map((n) => rects.get(n.id))
  const minX = Math.min(...rs.map((r) => r.x))
  const maxX = Math.max(...rs.map((r) => r.x + r.w))
  const minY = Math.min(...rs.map((r) => r.y))
  const maxY = Math.max(...rs.map((r) => r.y + r.h))
  let best = null
  for (let x = minX; x < maxX - WINDOW.w / 2; x += 100) {
    for (let y = minY; y < maxY - WINDOW.h / 2; y += 100) {
      const w = { x, y, ...WINDOW }
      let score = 0
      for (const e of edges) for (const ev of events.get(e.id)) if (inside(w, at(e.path, (ev.from + ev.to) / 2))) score += ev.kind === 'edge' ? 1 : 2
      if (!best || score > best.score) best = { ...w, score }
    }
  }
  const win = { x: Math.round(best.x), y: Math.round(best.y), w: WINDOW.w, h: WINDOW.h }

  // the densest stretch of each edge, a short gap around it
  const candidates = []
  for (const e of edges) {
    if (e.length < 300) continue
    const list = events
      .get(e.id)
      .filter((ev) => ev.to > MIN_STUB && ev.from < e.length - MIN_STUB && inside(win, at(e.path, (ev.from + ev.to) / 2)))
      .sort((a, b) => a.from - b.from)
    if (list.length === 0) continue
    const groups = []
    for (const ev of list) {
      const last = groups[groups.length - 1]
      if (last && ev.from - last.to < 130) {
        last.to = Math.max(last.to, ev.to)
        last.count += 1
      } else groups.push({ from: ev.from, to: ev.to, count: 1 })
    }
    groups.sort((a, b) => b.count - a.count)
    const g = groups[0]
    let d0 = g.from - MARGIN
    let d1 = g.to + MARGIN
    const grow = MIN_GAP - (d1 - d0)
    if (grow > 0) {
      d0 -= grow / 2
      d1 += grow / 2
    }
    d0 = Math.max(d0, MIN_STUB)
    d1 = Math.min(d1, e.length - MIN_STUB)
    if (d1 - d0 < MIN_GAP || d1 - d0 > MAX_GAP) continue
    candidates.push({ edge: e, d0, d1, count: g.count })
  }
  candidates.sort((a, b) => b.count - a.count || b.edge.length - a.edge.length)
  const middle = (c) => at(c.edge.path, (c.d0 + c.d1) / 2)
  const chosen = []
  for (const c of candidates) {
    const m = middle(c)
    // keep the portals apart from each other so each mark can be told
    if (chosen.some((o) => Math.hypot(middle(o).x - m.x, middle(o).y - m.y) < 110)) continue
    chosen.push(c)
    if (chosen.length === PORTALS) break
  }
  chosen.forEach((c, i) => {
    c.number = i + 1
    c.in = at(c.edge.path, c.d0)
    c.out = at(c.edge.path, c.d1)
  })
  return { style, edges, events, win, chosen }
}

// --- drawing

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const f = (n) => n.toFixed(1)
const angle = (u) => (Math.atan2(u.y, u.x) * 180) / Math.PI
const line = (a, b, cls = 'edge') => `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" class="${cls}"/>`
const arrow = (q, u) => {
  const nx = -u.y
  const ny = u.x
  return `<polygon points="${f(q.x)},${f(q.y)} ${f(q.x - u.x * 9 + nx * 4.5)},${f(q.y - u.y * 9 + ny * 4.5)} ${f(q.x - u.x * 9 - nx * 4.5)},${f(q.y - u.y * 9 - ny * 4.5)}" class="head"/>`
}
const tilde = (p, u) => `<path d="M -11 0 C -7 -6.5 -3.5 -6.5 0 0 S 7 6.5 11 0" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(angle(u) + 90)})" class="tilde"/>`
const oval = (p, u) => `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="5.5" ry="12" transform="rotate(${f(angle(u))} ${f(p.x)} ${f(p.y)})" class="oval"/>`
const num = (p, u, dir, n) => `<text x="${f(p.x + u.x * dir * 19)}" y="${f(p.y + u.y * dir * 19 + 4)}" text-anchor="middle" class="num">${n}</text>`
const hit = (p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="15" class="hit"/>`
const poly = (pts, cls = 'edge') => `<polyline points="${pts.map((p) => `${f(p.x)},${f(p.y)}`).join(' ')}" class="${cls}"/>`
const group = (n, inner) => `<g class="mk" data-p="${n}" style="--pair:var(--c${((n - 1) % 6) + 1})">${inner}</g>`

function lines(label, width, size) {
  const max = Math.max(6, Math.floor((width - 14) / (size * 0.55)))
  const rows = []
  for (const w of String(label).split(/\s+/)) {
    const last = rows[rows.length - 1]
    if (last !== undefined && (last + ' ' + w).length <= max) rows[rows.length - 1] = last + ' ' + w
    else rows.push(w)
  }
  return rows
}
function node(n, win) {
  const r = rects.get(n.id)
  if (r.x > win.x + win.w || r.x + r.w < win.x || r.y > win.y + win.h || r.y + r.h < win.y) return ''
  const size = n.style?.fontSize ?? 12
  const rows = lines(n.data?.label ?? '', r.w, size)
  const top = r.y + r.h / 2 - ((rows.length - 1) * size * 1.2) / 2 + size * 0.35
  const text = rows.map((row, i) => `<text x="${f(r.x + r.w / 2)}" y="${f(top + i * size * 1.2)}" font-size="${size}" text-anchor="middle" class="label">${esc(row)}</text>`).join('')
  if ((n.type ?? 'entity') === 'text') return text.replaceAll('class="label"', 'class="note"')
  return `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" rx="4" class="node"/>${text}`
}

// the edge up to a few units short of its end, and an arrowhead on that end
function whole(e) {
  const end = at(e.path, e.length)
  return poly(sub(e.path, 0, e.length - 7)) + arrow(end, end.u)
}

// kind: plain (every edge whole), portal (the chosen edges cut) or hops (a hop where an edge crosses one drawn before it)
function sheet(an, kind) {
  const { win, edges, chosen, events } = an
  let s = `<svg viewBox="${win.x} ${win.y} ${win.w} ${win.h}" data-w="${win.w}" role="img" aria-label="${an.style} edges, ${kind}">`
  s += `<rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" class="canvas"/>`
  s += diagram.nodes.map((n) => node(n, win)).join('')
  const cut = new Map(chosen.map((c) => [c.edge.id, c]))
  let marks = ''
  for (const e of edges) {
    const end = at(e.path, e.length)
    if (kind === 'hops') {
      const hops = events.get(e.id).filter((ev) => ev.kind === 'edge' && ev.other < e.index).sort((a, b) => a.from - b.from)
      let d = `M ${f(e.path.pts[0].x)} ${f(e.path.pts[0].y)}`
      let at0 = 0
      for (const h of hops) {
        const a = at(e.path, h.from - HOP)
        const b = at(e.path, h.from + HOP)
        if (h.from - HOP < at0 || h.from + HOP > e.length - 8) continue
        const sweep = a.u.x > 0 || (a.u.x === 0 && a.u.y > 0) ? 1 : 0
        d += ` L ${f(a.x)} ${f(a.y)} A ${HOP} ${HOP} 0 0 ${sweep} ${f(b.x)} ${f(b.y)}`
        at0 = h.from + HOP
      }
      const last = at(e.path, e.length - 7)
      s += `<path d="${d} L ${f(last.x)} ${f(last.y)}" class="edge"/>` + arrow(end, end.u)
      continue
    }
    const c = cut.get(e.id)
    if (kind === 'plain' || !c) {
      s += whole(e)
      continue
    }
    const n = c.number
    // the exit oval is drawn under the edge so the line comes out of it, the entry oval over it so the line goes into it
    s += group(n, oval(c.out, c.out.u) + hit(c.out))
    s += poly(sub(e.path, 0, c.d0)) + poly(sub(e.path, c.d1, e.length - 7)) + arrow(end, end.u)
    s += `<g class="mk whole" data-p="${n}" style="--pair:var(--c${((n - 1) % 6) + 1})">${poly(e.path.pts, 'wholeline')}</g>`
    marks += group(n, oval(c.in, c.in.u) + tilde(c.in, c.in.u) + tilde(c.out, c.out.u) + num(c.in, c.in.u, 1, n) + num(c.out, c.out.u, -1, n) + hit(c.in))
  }
  return s + marks + '</svg>'
}

const label = (id) => esc(byId.get(id).data?.label)
function portalList(an) {
  return an.chosen.map((c) => `${c.number}: ${label(c.edge.source)} to ${label(c.edge.target)} (gap ${Math.round(c.d1 - c.d0)} units, ${c.count} crossing${c.count === 1 ? '' : 's'})`).join('</li><li>')
}

const analyses = ['straight', 'step', 'curved'].map(analyse)
const [straight] = analyses
const names = { straight: 'Straight edges', step: 'Step edges', curved: 'Curved edges' }
const routed = analyses
  .map(
    (an) => `<h2>${names[an.style]}</h2>
<p>As it is, and with ${an.chosen.length} portals cut where an edge crosses something. Hover a mark: the whole edge is drawn dashed over everything else.</p>
<ul><li>${portalList(an)}</li></ul>
${sheet(an, 'plain')}${sheet(an, 'portal')}`
  )
  .join('\n')

// --- the demo of setting a gap: one edge, two crossings and an element on its way

const demoEvents = [
  { from: 140, to: 140, kind: 'edge' },
  { from: 220, to: 220, kind: 'edge' },
  { from: 270, to: 340, kind: 'element' }
]
const demo = `<svg id="demoSvg" viewBox="0 0 640 260" data-w="640" role="img" aria-label="Setting a gap">
<rect width="640" height="260" class="canvas"/>
<rect x="20" y="110" width="90" height="50" rx="4" class="node"/><text x="65" y="139" text-anchor="middle" class="label" font-size="12">Source</text>
<rect x="530" y="110" width="90" height="50" rx="4" class="node"/><text x="575" y="139" text-anchor="middle" class="label" font-size="12">Target</text>
<rect x="380" y="100" width="70" height="70" rx="4" class="node"/><text x="415" y="139" text-anchor="middle" class="label" font-size="12">Cache</text>
${line({ x: 250, y: 20 }, { x: 250, y: 236 })}${line({ x: 300, y: 236 }, { x: 345, y: 20 })}
<g id="demo"></g></svg>`

// the mark builders are shared with the page
const shared = [f, angle, line, arrow, tilde, oval, num].map((fn) => `const ${fn.name} = ${fn};`).join('\n')

// --- a portal point: many edges carried between the same two places

const box = (x, y, text) => `<rect x="${x}" y="${y}" width="110" height="40" rx="4" class="node"/><text x="${x + 55}" y="${y + 24}" text-anchor="middle" class="label" font-size="12">${text}</text>`
const pill = (x, text) => `<g class="mk" data-p="1" style="--pair:var(--c2)"><rect x="${x}" y="88" width="120" height="44" rx="22" class="pillbox"/>${oval({ x: x + 22, y: 110 }, { x: 1, y: 0 })}${tilde({ x: x + 22, y: 110 }, { x: 1, y: 0 })}<text x="${x + 38}" y="115" class="num">1</text><text x="${x + 76}" y="115" text-anchor="middle" class="label" font-size="11">${text}</text></g>`
const pointSheet = `<svg viewBox="0 0 900 220" data-w="900" role="img" aria-label="A portal point">
<rect width="900" height="220" class="canvas"/>
${['Ticketing', 'Fares', 'Payments'].map((t, i) => box(20, 20 + i * 62, t)).join('')}
${['Ledger', 'Reports', 'Audit'].map((t, i) => box(770, 20 + i * 62, t)).join('')}
${[0, 1, 2].map((i) => line({ x: 130, y: 40 + i * 62 }, { x: 330, y: 107 + (i - 1) * 6 })).join('')}
${[0, 1, 2].map((i) => line({ x: 570, y: 107 + (i - 1) * 6 }, { x: 770, y: 40 + i * 62 })).join('')}
${pill(210, 'to Back office')}${pill(570, 'from Front office')}
<text x="450" y="104" text-anchor="middle" class="note" font-size="12">three edges, one carried link</text>
</svg>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portals on a real diagram</title>
<style>
:root{--bg:#f4f4f1;--text:#1b1b1f;--sub:#5f6368;--canvas:#f8f8f8;--node:#ffffff;--nodeStroke:#c7ccd1;--line:#6b7280;--blue:#4a9be8;--hole:#dfe9f4;--panel:#ffffff;--c1:#2f7fd1;--c2:#d1602f;--c3:#2f9d6a;--c4:#9b55c9;--c5:#b88a12;--c6:#d13f77}
[data-theme=dark]{--bg:#161616;--text:#e8e8e0;--sub:#9aa0a6;--canvas:#222222;--node:#2d2d2d;--nodeStroke:#515c67;--line:#9aa0a6;--blue:#8ec1f3;--hole:#0e141b;--panel:#1d1d1d;--c1:#6fb0f0;--c2:#f0905f;--c3:#5fcf9a;--c4:#c995ee;--c5:#e6bc4a;--c6:#f27aa5}
body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 6px}p,li{color:var(--sub);max-width:900px}
.bar{display:flex;gap:14px;align-items:center;margin:14px 0;flex-wrap:wrap}button{font:inherit;padding:4px 12px;border:1px solid var(--nodeStroke);border-radius:6px;background:var(--panel);color:var(--text);cursor:pointer}
.bar span.k{color:var(--sub)}button.on{border-color:var(--blue);outline:1px solid var(--blue)}
.canvas{fill:var(--canvas)}.node{fill:var(--node);stroke:var(--nodeStroke);stroke-width:1.5}.pillbox{fill:var(--node);stroke:var(--k,var(--blue));stroke-width:1.5}.label{fill:var(--text);font-family:system-ui,sans-serif}.note{fill:var(--sub);font-family:system-ui,sans-serif}
.edge{stroke:var(--line);stroke-width:1.5;fill:none}.head{fill:var(--line)}
html[data-colour=pair] .mk{--k:var(--pair)}html[data-colour=blue] .mk{--k:var(--blue)}
.tilde{fill:none;stroke:var(--k);stroke-width:2.4;stroke-linecap:round}.oval{fill:var(--hole);stroke:var(--k);stroke-width:2}.num{fill:var(--k);font:600 12px system-ui,sans-serif}
html[data-mark=tilde] .oval{display:none}html[data-mark=oval] .tilde{display:none}
.hit{fill:transparent}.whole{pointer-events:none;opacity:0}.wholeline{fill:none;stroke:var(--k);stroke-width:2;stroke-dasharray:6 4}.hot.whole{opacity:.9}.mk.hot .tilde{stroke-width:3.6}.mk.hot .oval{stroke-width:3.2}
svg{display:block;border-radius:8px;max-width:100%;height:auto;margin:8px 0}
.panel{display:inline-block;vertical-align:top;margin:8px 0 0 16px;padding:12px 14px;background:var(--panel);border:1px solid var(--nodeStroke);border-radius:8px;min-width:250px;color:var(--text)}
.panel h3{font-size:13px;margin:0 0 8px}.panel label{display:block;margin:8px 0 0;color:var(--sub)}.panel input[type=range]{width:100%}.panel .read{margin-top:10px;color:var(--sub);font-size:13px}
</style></head><body>
<h1>Portals on a real diagram</h1>
<p>The Meridian Rail landscape of the gallery (${diagram.nodes.length} elements, ${diagram.edges.length} edges), a window of it where edges cross one another and run across elements, drawn with straight, step and curved edges (the edges are approximations of the app's, not the app). A portal is a short gap cut where an edge would cross something, with a mark at both ends and the same number on both. This is a mock-up (epic 0205): nothing of it is in the app.</p>
<div class="bar"><span class="k">Theme</span><button data-set="theme" data-v="light">Light</button><button data-set="theme" data-v="dark">Dark</button>
<span class="k">Mark</span><button data-set="mark" data-v="tilde">Tilde</button><button data-set="mark" data-v="oval">Oval</button>
<span class="k">Colour</span><button data-set="colour" data-v="blue">One light blue</button><button data-set="colour" data-v="pair">One per pair</button>
<label>Zoom <input id="zoom" type="range" min="30" max="110" value="100"> <span id="zoomText">100%</span></label></div>
${routed}
<h2>The alternative: line hops</h2>
<p>The same straight edges with a small hop where an edge crosses one drawn before it. The crossings stay, so a busy stretch gets no quieter; it only tells which line goes on. This is the sketch the epic asks for, not a candidate.</p>
${sheet(straight, 'hops')}
<h2>Setting a gap</h2>
<p>One edge with two crossings and an element on its way. Two sliders set where the gap starts and ends, measured from the source; they are clamped so they never swap and never touch the elements. Add portals puts a short gap at the first crossing. On the canvas there would be a drag handle for each end too (not mocked).</p>
${demo}<div class="panel"><h3>Edge: Source to Target</h3>
<label><input type="checkbox" id="on"> Break the edge (portal)</label>
<label>Gap starts <span id="sText"></span><input type="range" id="s" min="0" max="420" value="102"></label>
<label>Gap ends <span id="eText"></span><input type="range" id="e" min="0" max="420" value="178"></label>
<p style="margin:10px 0 0"><button id="add">Add portals</button></p><div class="read" id="read"></div></div>
<h2>A portal point</h2>
<p>One reading of the idea: three edges run into one point and three come out of the matching point, so one carried link stands for many edges. The two points share the number and the colour. What the point holds (a list of edges, or just a name), and whether the edges are real edges of the diagram or something else, is open.</p>
${pointSheet}
<script>
${shared}
const root=document.documentElement;
const state={theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',mark:'oval',colour:'blue'};
function apply(){root.dataset.theme=state.theme;root.dataset.mark=state.mark;root.dataset.colour=state.colour;document.querySelectorAll('[data-set]').forEach(b=>b.classList.toggle('on',state[b.dataset.set]===b.dataset.v))}
document.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click',()=>{state[b.dataset.set]=b.dataset.v;apply()}));apply();
const svgs=[...document.querySelectorAll('svg')],zoom=document.getElementById('zoom'),zoomText=document.getElementById('zoomText');
function fit(){const z=zoom.value/100;zoomText.textContent=zoom.value+'%';svgs.forEach(s=>{s.style.width=Math.round(s.dataset.w*z)+'px'})}
zoom.addEventListener('input',fit);fit();
svgs.forEach(svg=>{svg.addEventListener('mouseover',ev=>{const g=ev.target.closest('[data-p]');if(!g)return;svg.querySelectorAll('[data-p="'+g.dataset.p+'"]').forEach(x=>x.classList.add('hot'))});svg.addEventListener('mouseout',()=>svg.querySelectorAll('.hot').forEach(x=>x.classList.remove('hot')))});
(function(){
const L=420,MIN_STUB=${MIN_STUB},MIN_GAP=${MIN_GAP},MARGIN=${MARGIN},P={x:110,y:135},u={x:1,y:0},events=${JSON.stringify(demoEvents)};
const g=document.getElementById('demo'),on=document.getElementById('on'),sl=document.getElementById('s'),el=document.getElementById('e'),read=document.getElementById('read');
const pt=d=>({x:P.x+d,y:P.y});
function render(){
  const s=+sl.value,e=+el.value,end=pt(L);
  document.getElementById('sText').textContent=s+' px';document.getElementById('eText').textContent=e+' px';
  sl.disabled=el.disabled=!on.checked;
  let h='';
  if(!on.checked){h=line(P,pt(L-7))+arrow(end,u);read.textContent='A whole edge: it crosses 2 edges and runs across the Cache element.'}
  else{
    const a=pt(s),b=pt(e),skipped=events.filter(v=>v.to>=s&&v.from<=e).length;
    h='<g class="mk" style="--pair:var(--c1)">'+oval(b,u)+'</g>'+line(P,a)+line(b,pt(L-7))+arrow(end,u)+'<g class="mk" style="--pair:var(--c1)">'+oval(a,u)+tilde(a,u)+tilde(b,u)+num(a,u,1,1)+num(b,u,-1,1)+'</g>';
    read.textContent='Hides '+(e-s)+' px and skips '+skipped+' of the 3 crossings; '+(3-skipped)+' still drawn over the edge.';
  }
  g.innerHTML=h;
}
sl.addEventListener('input',()=>{sl.value=Math.max(MIN_STUB,Math.min(+sl.value,+el.value-MIN_GAP));render()});
el.addEventListener('input',()=>{el.value=Math.min(L-MIN_STUB,Math.max(+el.value,+sl.value+MIN_GAP));render()});
on.addEventListener('change',render);
document.getElementById('add').addEventListener('click',()=>{const half=Math.max(MARGIN,MIN_GAP/2),c=events[0].from;on.checked=true;sl.value=c-half;el.value=c+half;render()});
render();
})();
</script></body></html>
`
writeFileSync(out, html)
for (const an of analyses) {
  console.log(`${an.style}: window ${an.win.x},${an.win.y} ${an.win.w}x${an.win.h}; portals: ${an.chosen.length}`)
  for (const c of an.chosen) console.log(`  ${c.number}: ${byId.get(c.edge.source).data?.label} -> ${byId.get(c.edge.target).data?.label}, gap ${Math.round(c.d1 - c.d0)}, crossings ${c.count}`)
}
