// Builds docs/experiments/portals-on-a-real-diagram.html: a mock-up of portals (epic 0205) on a real,
// messy diagram, the Meridian Rail landscape of the gallery. Nothing here is the app: the edges are
// drawn straight between their connection points, the portals are cut where an edge crosses another
// edge or an element, and the page draws the cut with a tilde and with an oval, so the two marks can
// be compared on the same crossings. Run: node docs/experiments/build-portals-on-a-real-diagram.mjs
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

const diagram = JSON.parse(readFileSync(source, 'utf8'))
const byId = new Map(diagram.nodes.map((n) => [n.id, n]))

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

// Where an edge meets an element: the stored connection point (the points of a side are spread
// evenly in the order of their offsets), or the middle of the side facing the other end.
function endpoint(node, handle, towards) {
  const r = rectOf(node)
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
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const dx = towards.x - cx
    const dy = towards.y - cy
    side = Math.abs(dx) * r.h > Math.abs(dy) * r.w ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top'
  }
  if (side === 'top') return { x: r.x + frac * r.w, y: r.y }
  if (side === 'bottom') return { x: r.x + frac * r.w, y: r.y + r.h }
  if (side === 'left') return { x: r.x, y: r.y + frac * r.h }
  return { x: r.x + r.w, y: r.y + frac * r.h }
}

const centre = (n) => {
  const r = rectOf(n)
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

const edges = []
for (const e of diagram.edges) {
  const s = byId.get(e.source)
  const t = byId.get(e.target)
  if (!s || !t) continue
  const p = endpoint(s, e.sourceHandle, centre(t))
  const q = endpoint(t, e.targetHandle, centre(s))
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  if (length > 1) edges.push({ id: e.id, source: e.source, target: e.target, p, q, length })
}

// t along p->q where it crosses a->b, or null
function segment(p, q, a, b) {
  const rx = q.x - p.x
  const ry = q.y - p.y
  const sx = b.x - a.x
  const sy = b.y - a.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den
  const u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null
}
// the stretch [t0, t1] of p->q inside a rectangle, or null
function through(p, q, r) {
  let t0 = 0
  let t1 = 1
  const d = { x: q.x - p.x, y: q.y - p.y }
  for (const [pos, delta, lo, hi] of [
    [p.x, d.x, r.x, r.x + r.w],
    [p.y, d.y, r.y, r.y + r.h]
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (pos < lo || pos > hi) return null
    } else {
      let a = (lo - pos) / delta
      let b = (hi - pos) / delta
      if (a > b) [a, b] = [b, a]
      t0 = Math.max(t0, a)
      t1 = Math.min(t1, b)
      if (t0 >= t1) return null
    }
  }
  return [t0, t1]
}

// what each edge crosses: other edges (a point) and elements it is not joined to (a stretch)
const events = new Map(edges.map((e) => [e.id, []]))
for (let i = 0; i < edges.length; i += 1) {
  for (let j = i + 1; j < edges.length; j += 1) {
    const a = edges[i]
    const b = edges[j]
    if ([a.source, a.target].some((id) => id === b.source || id === b.target)) continue
    const ta = segment(a.p, a.q, b.p, b.q)
    const tb = segment(b.p, b.q, a.p, a.q)
    if (ta === null || tb === null) continue
    events.get(a.id).push({ from: ta, to: ta, kind: 'edge' })
    events.get(b.id).push({ from: tb, to: tb, kind: 'edge' })
  }
}
const entities = diagram.nodes.filter((n) => (n.type ?? 'entity') === 'entity')
for (const e of edges) {
  for (const n of entities) {
    if (n.id === e.source || n.id === e.target) continue
    const stretch = through(e.p, e.q, rectOf(n))
    if (stretch && stretch[1] - stretch[0] > 0.004) events.get(e.id).push({ from: stretch[0], to: stretch[1], kind: 'element' })
  }
}
const at = (e, t) => ({ x: e.p.x + (e.q.x - e.p.x) * t, y: e.p.y + (e.q.y - e.p.y) * t })

// --- the window with the most trouble in it

const inside = (w, pt) => pt.x >= w.x && pt.x <= w.x + w.w && pt.y >= w.y && pt.y <= w.y + w.h
let best = null
const xs = entities.map((n) => rectOf(n))
const minX = Math.min(...xs.map((r) => r.x))
const maxX = Math.max(...xs.map((r) => r.x + r.w))
const minY = Math.min(...xs.map((r) => r.y))
const maxY = Math.max(...xs.map((r) => r.y + r.h))
for (let x = minX; x < maxX - WINDOW.w / 2; x += 100) {
  for (let y = minY; y < maxY - WINDOW.h / 2; y += 100) {
    const w = { x, y, ...WINDOW }
    let score = 0
    for (const e of edges) {
      for (const ev of events.get(e.id)) if (inside(w, at(e, (ev.from + ev.to) / 2))) score += ev.kind === 'edge' ? 1 : 2
    }
    if (!best || score > best.score) best = { ...w, score }
  }
}
const win = { x: Math.round(best.x), y: Math.round(best.y), w: WINDOW.w, h: WINDOW.h }

// --- where to cut: the densest stretch of each edge, a short gap around it

const candidates = []
for (const e of edges) {
  if (e.length < 300) continue
  const list = events
    .get(e.id)
    .filter((ev) => ev.to > 0.04 && ev.from < 0.96 && inside(win, at(e, (ev.from + ev.to) / 2)))
    .sort((a, b) => a.from - b.from)
  if (list.length === 0) continue
  // group events that are close along the edge, take the group with the most in it
  const groups = []
  for (const ev of list) {
    const last = groups[groups.length - 1]
    if (last && (ev.from - last.to) * e.length < 130) {
      last.to = Math.max(last.to, ev.to)
      last.count += 1
    } else groups.push({ from: ev.from, to: ev.to, count: 1 })
  }
  groups.sort((a, b) => b.count - a.count)
  const g = groups[0]
  let d0 = g.from * e.length - MARGIN
  let d1 = g.to * e.length + MARGIN
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
const chosen = []
for (const c of candidates) {
  const mid = at(c.edge, (c.d0 + c.d1) / 2 / c.edge.length)
  // keep the portals apart from each other so each mark can be told
  if (chosen.some((o) => Math.hypot(at(o.edge, (o.d0 + o.d1) / 2 / o.edge.length).x - mid.x, at(o.edge, (o.d0 + o.d1) / 2 / o.edge.length).y - mid.y) < 110)) continue
  chosen.push(c)
  if (chosen.length === PORTALS) break
}
chosen.forEach((c, i) => {
  c.number = i + 1
  c.in = at(c.edge, c.d0 / c.edge.length)
  c.out = at(c.edge, c.d1 / c.edge.length)
  c.u = { x: (c.edge.q.x - c.edge.p.x) / c.edge.length, y: (c.edge.q.y - c.edge.p.y) / c.edge.length }
})

// --- drawing

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const f = (n) => n.toFixed(1)
function lines(label, width, size) {
  const max = Math.max(6, Math.floor((width - 14) / (size * 0.55)))
  const words = String(label).split(/\s+/)
  const rows = []
  for (const w of words) {
    const last = rows[rows.length - 1]
    if (last !== undefined && (last + ' ' + w).length <= max) rows[rows.length - 1] = last + ' ' + w
    else rows.push(w)
  }
  return rows
}
function node(n) {
  const r = rectOf(n)
  if (r.x > win.x + win.w || r.x + r.w < win.x || r.y > win.y + win.h || r.y + r.h < win.y) return ''
  const size = n.style?.fontSize ?? 12
  const rows = lines(n.data?.label ?? '', r.w, size)
  const top = r.y + r.h / 2 - ((rows.length - 1) * size * 1.2) / 2 + size * 0.35
  const text = rows.map((row, i) => `<text x="${f(r.x + r.w / 2)}" y="${f(top + i * size * 1.2)}" font-size="${size}" text-anchor="middle" class="label">${esc(row)}</text>`).join('')
  if ((n.type ?? 'entity') === 'text') return text.replaceAll('class="label"', 'class="note"')
  return `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" rx="4" class="node"/>${text}`
}
function arrow(q, u) {
  const nx = -u.y
  const ny = u.x
  return `<polygon points="${f(q.x)},${f(q.y)} ${f(q.x - u.x * 9 + nx * 4.5)},${f(q.y - u.y * 9 + ny * 4.5)} ${f(q.x - u.x * 9 - nx * 4.5)},${f(q.y - u.y * 9 - ny * 4.5)}" class="head"/>`
}
const line = (a, b, cls = 'edge') => `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" class="${cls}"/>`
const angle = (u) => (Math.atan2(u.y, u.x) * 180) / Math.PI
const tilde = (p, u) => `<path d="M -11 0 C -7 -6.5 -3.5 -6.5 0 0 S 7 6.5 11 0" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(angle(u) + 90)})" class="tilde"/>`
const oval = (p, u) => `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="5.5" ry="12" transform="rotate(${f(angle(u))} ${f(p.x)} ${f(p.y)})" class="oval"/>`
const num = (p, u, dir, n) => `<text x="${f(p.x + u.x * dir * 19)}" y="${f(p.y + u.y * dir * 19 + 4)}" text-anchor="middle" class="num">${n}</text>`

function sheet(kind) {
  let s = `<svg viewBox="${win.x} ${win.y} ${win.w} ${win.h}" data-w="${win.w}" role="img" aria-label="${kind}">`
  s += `<rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" class="canvas"/>`
  s += diagram.nodes.map(node).join('')
  const cut = new Map(chosen.map((c) => [c.edge.id, c]))
  for (const e of edges) {
    const u = { x: (e.q.x - e.p.x) / e.length, y: (e.q.y - e.p.y) / e.length }
    const c = cut.get(e.id)
    if (kind === 'plain' || !c) {
      s += line(e.p, { x: e.q.x - u.x * 7, y: e.q.y - u.y * 7 }) + arrow(e.q, u)
      continue
    }
    if (kind === 'oval') s += oval(c.out, c.u)
    s += line(e.p, c.in) + line(c.out, { x: e.q.x - u.x * 7, y: e.q.y - u.y * 7 }) + arrow(e.q, u)
    s += kind === 'oval' ? oval(c.in, c.u) : tilde(c.in, c.u) + tilde(c.out, c.u)
    s += num(c.in, c.u, 1, c.number) + num(c.out, c.u, -1, c.number)
  }
  return s + '</svg>'
}

const marks = chosen
  .map((c) => `${c.number}: ${esc(byId.get(c.edge.source).data?.label)} to ${esc(byId.get(c.edge.target).data?.label)} (gap ${Math.round(c.d1 - c.d0)} units, ${c.count} crossing${c.count === 1 ? '' : 's'})`)
  .join('</li><li>')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portals on a real diagram</title>
<style>
:root{--bg:#f4f4f1;--text:#1b1b1f;--sub:#5f6368;--canvas:#f8f8f8;--node:#ffffff;--nodeStroke:#c7ccd1;--line:#6b7280;--blue:#2f7fd1;--hole:#dfe9f4;--panel:#ffffff}
[data-theme=dark]{--bg:#161616;--text:#e8e8e0;--sub:#9aa0a6;--canvas:#222222;--node:#2d2d2d;--nodeStroke:#515c67;--line:#9aa0a6;--blue:#8ec1f3;--hole:#0e141b;--panel:#1d1d1d}
body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 6px}p,li{color:var(--sub);max-width:900px}
.bar{display:flex;gap:14px;align-items:center;margin:14px 0;flex-wrap:wrap}button{font:inherit;padding:4px 12px;border:1px solid var(--nodeStroke);border-radius:6px;background:var(--panel);color:var(--text);cursor:pointer}
.canvas{fill:var(--canvas)}.node{fill:var(--node);stroke:var(--nodeStroke);stroke-width:1.5}.label{fill:var(--text);font-family:system-ui,sans-serif}.note{fill:var(--sub);font-family:system-ui,sans-serif}
.edge{stroke:var(--line);stroke-width:1.5;fill:none}.head{fill:var(--line)}
.tilde{fill:none;stroke:var(--blue);stroke-width:2.4;stroke-linecap:round}.oval{fill:var(--hole);stroke:var(--blue);stroke-width:2}.num{fill:var(--blue);font:500 12px system-ui,sans-serif}
svg{display:block;border-radius:8px;max-width:100%;height:auto}
</style></head><body>
<h1>Portals on a real diagram</h1>
<p>The Meridian Rail landscape of the gallery (${diagram.nodes.length} elements, ${diagram.edges.length} edges), a window of it where edges cross one another and run across elements. The edges are drawn straight between their connection points here, not as the app draws them. Each portal is a short gap cut where an edge would cross something, with a mark at both ends and the same number on both. This is a mock-up (epic 0205): nothing of it is in the app.</p>
<ul><li>${marks}</li></ul>
<div class="bar"><span>Theme</span><button data-theme-set="light">Light</button><button data-theme-set="dark">Dark</button><label>Zoom <input id="zoom" type="range" min="30" max="110" value="100"> <span id="zoomText">100%</span></label></div>
<h2>As it is: the edges cross</h2>${sheet('plain')}
<h2>Portals with a tilde across the edge</h2>${sheet('tilde')}
<h2>Portals with an oval: the line goes into the one drawn over it and out of the one drawn under it</h2>${sheet('oval')}
<script>
const svgs=[...document.querySelectorAll('svg')],zoom=document.getElementById('zoom'),text=document.getElementById('zoomText');
function fit(){const z=zoom.value/100;text.textContent=zoom.value+'%';svgs.forEach(s=>{s.style.width=Math.round(s.dataset.w*z)+'px'})}
zoom.addEventListener('input',fit);fit();
document.querySelectorAll('[data-theme-set]').forEach(b=>b.addEventListener('click',()=>{document.documentElement.dataset.theme=b.dataset.themeSet}));
document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
</script></body></html>
`
writeFileSync(out, html)
console.log(`window ${win.x},${win.y} ${win.w}x${win.h}; portals: ${chosen.length}`)
for (const c of chosen) console.log(`${c.number}: ${byId.get(c.edge.source).data?.label} -> ${byId.get(c.edge.target).data?.label}, gap ${Math.round(c.d1 - c.d0)}, crossings ${c.count}`)
