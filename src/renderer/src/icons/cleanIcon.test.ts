import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { MAX_ICON_SOURCE_LENGTH } from '@shared/icons/pack'
import { cleanIcon, iconIdPrefix, isolateIcon } from './cleanIcon'

const svg = (inner: string, attrs = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" ${attrs}>${inner}</svg>`

// What a browser would make of the markup that is drawn, to look at what ends up in the page.
function drawn(markup: string): Element {
  const host = document.createElement('div')
  host.innerHTML = markup
  return host.firstElementChild as Element
}

function clean(source: string): string {
  const out = cleanIcon(source)
  expect(out).not.toBeNull()
  return out as string
}

describe('cleanIcon: what is removed', () => {
  it('removes scripts, event attributes and javascript links', () => {
    const out = clean(
      svg(
        '<script>alert(1)</script><path d="M0 0h1" onclick="alert(2)"/><circle r="2" onload="alert(3)"/>',
        'onload="alert(4)"'
      )
    )
    expect(out).not.toMatch(/script|alert|onclick|onload/i)
    expect(out).toContain('<path')
  })

  it('removes foreignObject and anything HTML inside it', () => {
    const out = clean(
      svg(
        '<foreignObject width="10" height="10"><div onmouseover="x()">hi</div></foreignObject><path d="M0 0"/>'
      )
    )
    expect(out).not.toMatch(/foreignObject|<div|hi/)
  })

  it('removes animation, which can set an href or an event later', () => {
    const out = clean(
      svg(
        '<path d="M0 0"><animate attributeName="href" to="javascript:alert(1)"/><set attributeName="onclick" to="x()"/></path><animateTransform attributeName="transform"/>'
      )
    )
    expect(out).not.toMatch(/animate|<set/i)
  })

  it('removes links and any reference that leaves the file', () => {
    const out = clean(
      svg(
        '<a href="https://example.com"><path d="M0 0"/></a>' +
          '<use href="https://example.com/x.svg#a"/><use xlink:href="other.svg#a"/>' +
          '<image href="https://example.com/p.png" width="4" height="4"/>'
      )
    )
    expect(out).not.toMatch(/example\.com|other\.svg|<a[ >]/)
  })

  it('keeps a raster picture carried in the file and refuses one that is not', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const out = clean(
      svg(
        `<image href="${png}" width="4" height="4"/><image href="data:image/svg+xml;base64,PHN2Zz4=" width="4" height="4"/>`
      )
    )
    expect(out).toContain(png)
    expect(out).not.toContain('svg+xml')
  })

  it('removes a url() that points outside the file, in an attribute or in a style', () => {
    const out = clean(
      svg(
        '<path d="M0 0" fill="url(https://example.com/a.svg#g)" style="stroke:url(http://example.com/x);fill:red"/>' +
          '<rect width="2" height="2" style="fill:url(data:image/svg+xml;base64,AAAA)"/>' +
          '<rect width="3" height="3" fill="url(data:image/svg+xml;base64,AAAA)" stroke="url(#ok"/>'
      )
    )
    expect(out).not.toMatch(/example\.com|data:image|url\(#ok/)
    expect(out).toContain('fill:red')
  })

  it('drops style properties that could move or cover other things', () => {
    const out = clean(
      svg(
        '<path d="M0 0" style="position:fixed;top:0;left:0;width:100vw;z-index:9;fill:blue;behavior:url(x.htc)"/>'
      )
    )
    expect(out).toContain('fill:blue')
    expect(out).not.toMatch(/position|z-index|width:100vw|behavior/)
  })

  it('removes overflow, so nothing is drawn outside the icon', () => {
    const out = clean(svg('<path d="M0 0"/>', 'overflow="visible" style="overflow:visible"'))
    expect(out).not.toMatch(/overflow/)
  })

  it('returns null for a file that holds no SVG, and for one that is too large', () => {
    expect(cleanIcon('<div>not an icon</div>')).toBeNull()
    expect(cleanIcon('')).toBeNull()
    expect(cleanIcon(svg('<path d="M0 0"/>' + ' '.repeat(MAX_ICON_SOURCE_LENGTH)))).toBeNull()
  })
})

describe('cleanIcon: styles', () => {
  it('turns a <style> element into style attributes and takes the element away', () => {
    const out = clean(
      svg(
        '<defs><style>.cls-1{fill:#f90}.cls-2{stroke:#232f3e;stroke-width:2}</style></defs>' +
          '<path class="cls-1" d="M0 0"/><path class="cls-2" d="M1 1"/>'
      )
    )
    expect(out).not.toMatch(/<style|class=/)
    const [first, second] = Array.from(drawn(out).querySelectorAll('path'))
    expect(first.getAttribute('style')).toBe('fill:#f90')
    expect(second.getAttribute('style')).toBe('stroke:#232f3e;stroke-width:2')
  })

  it('does not let a rule reach the page or other icons', () => {
    const out = clean(
      svg(
        '<style>body{display:none}div,button{fill:red}.x{fill:green}</style><path class="x" d="M0 0"/>'
      )
    )
    expect(out).not.toMatch(/body|<style|display/)
    expect(drawn(out).querySelector('path')?.getAttribute('style')).toBe('fill:green')
  })

  it('skips at-rules whole: @import, @media, @font-face, @keyframes', () => {
    const out = clean(
      svg(
        '<style>@import url(https://example.com/a.css);@media print{.x{fill:red}}@font-face{font-family:f;src:url(https://example.com/f.woff)}.x{fill:green}@keyframes k{from{fill:red}to{fill:blue}}</style><path class="x" d="M0 0"/>'
      )
    )
    expect(out).not.toMatch(/example\.com|keyframes|red|blue/)
    expect(drawn(out).querySelector('path')?.getAttribute('style')).toBe('fill:green')
  })

  it('lets the element own style win over a rule, and a rule win over an attribute', () => {
    const out = clean(
      svg(
        '<style>.x{fill:red;stroke:red}</style><path class="x" fill="black" style="stroke:blue" d="M0 0"/>'
      )
    )
    expect(drawn(out).querySelector('path')?.getAttribute('style')).toBe('fill:red;stroke:blue')
  })

  it('ignores a selector that is not valid, and one with a state', () => {
    const out = clean(
      svg('<style>.x:hover{fill:red}[[{fill:red}.y{fill:green}</style><path class="y" d="M0 0"/>')
    )
    expect(drawn(out).querySelector('path')?.getAttribute('style')).toBe('fill:green')
  })
})

describe('cleanIcon: colour', () => {
  it('leaves currentColor and fixed colours as the author wrote them', () => {
    const tabler = clean(svg('<path d="M0 0" stroke="currentColor" fill="none"/>'))
    expect(tabler).toContain('stroke="currentColor"')
    const vendor = clean(svg('<path d="M0 0" fill="#ff9900"/>'))
    expect(vendor).toContain('fill="#ff9900"')
  })

  it('keeps gradients, clip paths, masks and strokes, which vendor icons use', () => {
    const out = clean(
      svg(
        '<defs><linearGradient id="a" x1="0" x2="1"><stop offset="0" stop-color="#f90"/><stop offset="1" stop-color="#c60"/></linearGradient>' +
          '<clipPath id="c"><rect width="10" height="10"/></clipPath><mask id="m"><rect width="5" height="5" fill="#fff"/></mask></defs>' +
          '<path d="M0 0h9v9z" fill="url(#a)" clip-path="url(#c)" mask="url(#m)" stroke="#000" stroke-linecap="round"/>'
      )
    )
    expect(out).toMatch(/<linearGradient/)
    expect(out).toMatch(/<clipPath/)
    expect(out).toMatch(/<mask/)
    expect(out).toContain('stroke-linecap="round"')
  })
})

describe('isolateIcon', () => {
  const vendor = clean(
    svg(
      '<defs><linearGradient id="a"><stop offset="0" stop-color="#f90"/></linearGradient>' +
        '<clipPath id="clip"><rect width="9" height="9"/></clipPath></defs>' +
        '<g clip-path="url(#clip)"><path d="M0 0" fill="url(#a)"/></g>' +
        '<use href="#a"/><use xlink:href="#clip"/>'
    )
  )

  const idsOf = (markup: string): string[] =>
    Array.from(drawn(markup).querySelectorAll('[id]')).map((e) => e.id)

  it('gives two icons with the same ids different ones', () => {
    const one = idsOf(isolateIcon(vendor, 'AWS/Compute/EC2.svg', 1))
    const two = idsOf(isolateIcon(vendor, 'AWS/Compute/S3.svg', 2))
    expect(one).toHaveLength(2)
    expect(two.filter((id) => one.includes(id))).toEqual([])
  })

  it('gives the same icon drawn twice different ids', () => {
    const first = idsOf(isolateIcon(vendor, 'AWS/Compute/EC2.svg', 1))
    const second = idsOf(isolateIcon(vendor, 'AWS/Compute/EC2.svg', 2))
    expect(second.filter((id) => first.includes(id))).toEqual([])
  })

  it('tells places apart that read alike once the unusable characters are replaced', () => {
    expect(iconIdPrefix('P/S/EC2.svg', 1)).not.toBe(iconIdPrefix('P/S/ec2.svg', 1))
    expect(iconIdPrefix('P/S/a b.svg', 1)).not.toBe(iconIdPrefix('P/S/a_b.svg', 1))
  })

  it('moves every reference with its id', () => {
    const el = drawn(isolateIcon(vendor, 'AWS/Compute/EC2.svg', 7))
    const gradient = el.querySelector('linearGradient') as Element
    const clip = el.querySelector('clipPath') as Element
    expect(el.querySelector('path')?.getAttribute('fill')).toBe(`url(#${gradient.id})`)
    expect(el.querySelector('g')?.getAttribute('clip-path')).toBe(`url(#${clip.id})`)
    const uses = Array.from(el.querySelectorAll('use'))
    expect(uses[0].getAttribute('href')).toBe(`#${gradient.id}`)
    expect(uses[1].getAttribute('xlink:href')).toBe(`#${clip.id}`)
  })

  it('moves a reference made in a <style> rule', () => {
    const out = isolateIcon(
      clean(
        svg(
          '<defs><linearGradient id="g"><stop offset="0" stop-color="#f90"/></linearGradient></defs><style>.x{fill:url(#g)}</style><path class="x" d="M0 0"/>'
        )
      ),
      'P/S/i.svg',
      1
    )
    const el = drawn(out)
    expect(el.querySelector('path')?.getAttribute('style')).toBe(
      `fill:url(#${el.querySelector('linearGradient')?.id})`
    )
  })

  it('makes ids that are safe, and keeps one for the first of two that share a name', () => {
    const out = clean(
      svg('<path id="a b" d="M0 0"/><path id="a b" d="M1 1"/><path id="a_b" d="M2 2"/>')
    )
    const ids = idsOf(isolateIcon(out, 'P/S/i.svg', 1))
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('leaves no mark behind, and a reference to nothing stays as it was', () => {
    const out = isolateIcon(clean(svg('<path d="M0 0" fill="url(#nothing)"/>')), 'P/S/i.svg', 1)
    expect(out).not.toContain('\u0001')
    expect(out).toContain('url(#nothing)')
  })
})

describe('cleanIcon: real icons', () => {
  const dir = join(process.cwd(), 'node_modules/@tabler/icons/icons/outline')
  const names = readdirSync(dir).filter((f) => f.endsWith('.svg'))

  it('keeps Tabler icons as they are drawn: the same shapes, still in currentColor', () => {
    expect(names.length).toBeGreaterThan(1000)
    // Every 25th of the set keeps the run short; they are all made the same way.
    for (const name of names.filter((_, i) => i % 25 === 0)) {
      const source = readFileSync(join(dir, name), 'utf-8')
      const out = clean(source)
      const shapes = (s: string): number =>
        (s.match(/<(path|circle|rect|line|polyline|polygon|ellipse)/g) ?? []).length
      expect(shapes(out), name).toBe(shapes(source))
      expect(out, name).toContain('currentColor')
    }
  })

  it('cleans an exported vendor icon: classes, a gradient and a clip path made by a design tool', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Generator: Adobe Illustrator -->
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 80 80" style="enable-background:new 0 0 80 80;" xml:space="preserve">
<style type="text/css">
	.st0{fill:url(#SVGID_1_);}
	.st1{fill:#FFFFFF;}
</style>
<linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="80" y2="0">
	<stop offset="0" style="stop-color:#C8511B"/>
	<stop offset="1" style="stop-color:#FF9900"/>
</linearGradient>
<rect class="st0" width="80" height="80"/>
<defs><path id="SVGID_2_" d="M10 10h60v60H10z"/></defs>
<clipPath id="SVGID_3_"><use xlink:href="#SVGID_2_" style="overflow:visible;"/></clipPath>
<path class="st1" d="M20 20h40v40H20z" style="clip-path:url(#SVGID_3_);"/>
</svg>`
    const out = isolateIcon(clean(source), 'AWS/Compute/EC2.svg', 1)
    const el = drawn(out)
    expect(out).not.toMatch(/<style|class=|DOCTYPE|Illustrator|enable-background|overflow/)
    const gradient = el.querySelector('linearGradient') as Element
    expect(el.querySelector('rect')?.getAttribute('style')).toBe(`fill:url(#${gradient.id})`)
    const clip = el.querySelector('clipPath') as Element
    expect(el.querySelector('path:not(defs path)')?.getAttribute('style')).toBe(
      `fill:#FFFFFF;clip-path:url(#${clip.id})`
    )
    expect(clip.querySelector('use')?.getAttribute('xlink:href')).toBe(
      `#${el.querySelector('defs path')?.id}`
    )
  })
})
