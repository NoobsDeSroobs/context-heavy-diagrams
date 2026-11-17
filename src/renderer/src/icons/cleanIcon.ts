// Makes an installed icon safe to draw inline and keeps icons from touching each other (ADR 0188).
// An icon file is third-party input, and an inline SVG shares the page: it can run a script, load a
// resource, restyle the page with a <style> rule and share ids and classes with every other icon.
// Two steps, so the slow one runs once per icon and the cheap one once per drawing:
//   cleanIcon    sanitises the markup and returns it with a mark where an id prefix goes;
//   isolateIcon  puts the prefix of one drawing of one icon at the marks.
// Both work on the HTML parse of the file, which is how the markup is drawn (innerHTML).

import DOMPurify from 'dompurify'
import { MAX_ICON_SOURCE_LENGTH } from '@shared/icons/pack'

// Stands for the id prefix in cleaned markup. Anything else in the file that equals it is replaced
// by a prefix made of safe characters too, which does no harm.
const ID_MARK = '\u0001'

const FORBIDDEN_TAGS = [
  'script',
  'foreignObject',
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'set'
]

// What a <style> rule or a style attribute may say. Anything else (positioning, sizing, behaviours,
// URLs to other places) is dropped, so an icon cannot cover the interface or load a thing.
const ALLOWED_PROPERTIES = new Set([
  'clip-path',
  'clip-rule',
  'color',
  'color-interpolation-filters',
  'display',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'isolation',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'mix-blend-mode',
  'opacity',
  'paint-order',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'transform',
  'transform-origin',
  'vector-effect',
  'visibility'
])

// An image inside an icon may only be a raster picture carried in the file itself.
const INLINE_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]*$/i
// url(#id) is a reference inside the file, the only url() an icon may use.
const FRAGMENT_REFERENCE = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g

// Every `url(` must be a complete reference to an id in the file: a broken or cut one counts as
// one that leaves it.
function onlyFragmentUrls(value: string): boolean {
  const calls = value.match(/url\(/gi)?.length ?? 0
  return calls === Array.from(value.matchAll(FRAGMENT_REFERENCE)).length
}

function parseDeclarations(text: string | null): Map<string, string> {
  const found = new Map<string, string>()
  for (const part of (text ?? '').split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const property = part.slice(0, colon).trim().toLowerCase()
    const value = part
      .slice(colon + 1)
      .replace(/!important/gi, '')
      .trim()
    if (!ALLOWED_PROPERTIES.has(property) || !value) continue
    if (/[\\<>@]|expression|javascript|binding|behaviou?r/i.test(value)) continue
    if (!onlyFragmentUrls(value)) continue
    found.set(property, value)
  }
  return found
}

// The plain rules of a stylesheet, in order. At-rules (@import, @media, @font-face, @keyframes) are
// skipped whole, with what is inside them.
function parseRules(css: string): { selector: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: { selector: string; body: string }[] = []
  let depth = 0
  let start = 0
  let prelude = ''
  let bodyStart = 0
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '{') {
      if (depth === 0) {
        prelude = text.slice(start, i).trim()
        bodyStart = i + 1
      }
      depth += 1
    } else if (char === '}' && depth > 0) {
      depth -= 1
      if (depth === 0) {
        if (!prelude.startsWith('@'))
          rules.push({ selector: prelude, body: text.slice(bodyStart, i) })
        start = i + 1
      }
    } else if (char === ';' && depth === 0) {
      start = i + 1
    }
  }
  return rules
}

function matching(root: Element, selector: string): Element[] {
  try {
    const found = Array.from(root.querySelectorAll(selector))
    return root.matches(selector) ? [root, ...found] : found
  } catch {
    return []
  }
}

// A <style> element would restyle the whole page, and a class would be shared with other icons, so
// both go: what the rules say is written into each element's own style attribute, which the
// allowed properties limit, and the classes are dropped.
function inlineStyles(root: Element): void {
  const fromRules = new Map<Element, Map<string, string>>()
  for (const style of Array.from(root.querySelectorAll('style'))) {
    for (const rule of parseRules(style.textContent ?? '')) {
      const declarations = parseDeclarations(rule.body)
      if (declarations.size === 0) continue
      for (const element of matching(root, rule.selector)) {
        const merged = fromRules.get(element) ?? new Map<string, string>()
        for (const [property, value] of declarations) merged.set(property, value)
        fromRules.set(element, merged)
      }
    }
  }
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const merged = new Map([
      ...(fromRules.get(element) ?? []),
      ...parseDeclarations(element.getAttribute('style'))
    ])
    if (merged.size > 0) {
      element.setAttribute('style', [...merged].map(([k, v]) => `${k}:${v}`).join(';'))
    } else {
      element.removeAttribute('style')
    }
    element.removeAttribute('class')
  }
  for (const style of Array.from(root.querySelectorAll('style'))) style.remove()
}

// Nothing may point outside the file, and nothing may be drawn outside the icon's own box.
function removeOutsideReferences(root: Element): void {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const tag = element.tagName.toLowerCase()
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      let keep = true
      if (name.startsWith('on') || name === 'overflow') keep = false
      else if (name === 'href' || name === 'xlink:href') {
        const target = value.trim()
        keep =
          target.startsWith('#') ||
          ((tag === 'image' || tag === 'feimage') && INLINE_IMAGE.test(target))
      } else if (/url\(|javascript:/i.test(value)) {
        keep = onlyFragmentUrls(value) && !/javascript:/i.test(value)
      }
      if (!keep) element.removeAttribute(attribute.name)
    }
  }
}

// Gives every id a form that is safe in a selector and unique within the file, and rewrites what
// refers to it: href, url(#id) in an attribute or a style, and the aria id lists. The mark goes in
// front of each, to be replaced by a prefix at the time of drawing.
function markIds(root: Element): void {
  const renamed = new Map<string, string>()
  const taken = new Set<string>()
  for (const element of [root, ...Array.from(root.querySelectorAll('[id]'))]) {
    const original = element.getAttribute('id')
    if (original === null) continue
    if (renamed.has(original)) {
      // A second element with an id a first one has: browsers use the first, so it keeps the name.
      element.removeAttribute('id')
      continue
    }
    let safe = original.replace(/[^A-Za-z0-9_-]/g, '_') || 'id'
    while (taken.has(safe)) safe += '_'
    taken.add(safe)
    renamed.set(original, safe)
    element.setAttribute('id', ID_MARK + safe)
  }
  const rewriteUrls = (value: string): string =>
    value.replace(FRAGMENT_REFERENCE, (whole, _quote: string, id: string) => {
      const safe = renamed.get(id)
      return safe === undefined ? whole : `url(#${ID_MARK}${safe})`
    })
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name === 'id') continue
      if (name === 'href' || name === 'xlink:href') {
        const safe = renamed.get(attribute.value.trim().slice(1))
        if (safe !== undefined) element.setAttribute(attribute.name, `#${ID_MARK}${safe}`)
      } else if (name === 'aria-labelledby' || name === 'aria-describedby') {
        element.setAttribute(
          attribute.name,
          attribute.value
            .split(/\s+/)
            .map((id) => (renamed.has(id) ? ID_MARK + renamed.get(id) : id))
            .join(' ')
        )
      } else if (attribute.value.includes('url(')) {
        element.setAttribute(attribute.name, rewriteUrls(attribute.value))
      }
    }
  }
}

// The markup of an icon that is safe to draw inline, with the id prefix still to be set (see
// isolateIcon), or null when the file holds no drawable SVG. Colours are left as the author wrote
// them: an icon in currentColor takes the text colour, one with fixed colours keeps them.
export function cleanIcon(source: string): string | null {
  if (source.length > MAX_ICON_SOURCE_LENGTH) return null
  const body = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // <style> is read and removed below; <use> is how many exported icons repeat a shape, and is
    // safe once its href may only name an id inside the file (removeOutsideReferences).
    ADD_TAGS: ['style', 'use'],
    FORBID_TAGS: FORBIDDEN_TAGS,
    RETURN_DOM: true
  }) as HTMLElement
  const root = body.querySelector('svg')
  if (!root) return null
  inlineStyles(root)
  removeOutsideReferences(root)
  markIds(root)
  return root.outerHTML
}

// A short, stable number for a text (FNV-1a), to tell two places apart that read alike once the
// characters an id cannot hold are replaced (`EC2` and `ec2` are two files on Linux).
function shortHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

// The prefix of one drawing of one icon: the icon's place in its pack, a hash of that place, and a
// number the caller keeps unique per drawing, so the same icon on the canvas and in the picker does
// not repeat its ids (a gradient defined in a hidden element would not work from another place).
export function iconIdPrefix(place: string, use: number): string {
  const text = place.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)
  return `ic-${text}-${shortHash(place)}-${use}-`
}

export function isolateIcon(cleaned: string, place: string, use: number): string {
  return cleaned.split(ID_MARK).join(iconIdPrefix(place, use))
}
