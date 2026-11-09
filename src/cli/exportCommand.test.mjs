// Run with `npm test`. Builds the real `chd export` bundle (ADR 0124) and runs it the way the
// launchers do, as a child process.
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleExport } from '../../scripts/build-cli.mjs'

const root = join(import.meta.dirname, '..', '..')
const cli = join(root, 'resources', 'cli', 'chd.mjs')
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf-8' })

const diagram = (extra = {}) =>
  JSON.stringify({
    version: 1,
    nodes: [
      {
        id: 'a',
        type: 'entity',
        position: { x: 0, y: 0 },
        size: { width: 120, height: 60 },
        metadata: { risk: { value: 'high' } },
        data: { label: 'Alpha' }
      },
      {
        id: 'b',
        type: 'entity',
        position: { x: 300, y: 0 },
        size: { width: 120, height: 60 },
        data: { label: 'Beta' }
      }
    ],
    edges: [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' }],
    ...extra
  })

let dir
before(async () => {
  await bundleExport()
})
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-export-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('--help lists the export command and its options', () => {
  assert.match(run('--help').stdout, /chd export <file\.chd>/)
  const r = run('export', '--help')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /--background/)
})

test('writes an .svg next to the diagram by default and prints its path', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  const r = run('export', file)
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), join(dir, 'arch.svg'))
  const svg = await readFile(join(dir, 'arch.svg'), 'utf-8')
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.ok(svg.includes('Alpha') && svg.includes('Beta'))
  assert.ok(svg.includes('<title>arch</title>'))
})

test('the same diagram gives the same bytes twice, so a CI diff stays quiet', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  const first = run('export', file, '-o', '-').stdout
  const second = run('export', file, '-o', '-').stdout
  assert.equal(first, second)
  assert.ok(first.length > 100)
})

test('--theme, --background and --padding change the drawing', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  const width = (svg) => svg.match(/ width="(\d+)"/)[1]
  const plain = run('export', file, '-o', '-').stdout
  assert.ok(run('export', file, '-o', '-', '--theme', 'dark').stdout.includes('fill="#1b1b1f"'))
  assert.ok(
    !run('export', file, '-o', '-', '--background', 'transparent').stdout.includes('width="100%"')
  )
  assert.ok(
    run('export', file, '-o', '-', '--background', '#123456').stdout.includes('fill="#123456"')
  )
  assert.notEqual(width(run('export', file, '-o', '-', '--padding', '100').stdout), width(plain))
})

test('--highlight switches a highlight on, by key=value or by key', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram({ highlights: [{ key: 'risk', value: 'high', color: '#ff0000' }] }))
  assert.ok(!run('export', file, '-o', '-').stdout.includes('#ff0000'))
  assert.ok(run('export', file, '-o', '-', '--highlight', 'risk=high').stdout.includes('#ff0000'))
  assert.ok(run('export', file, '-o', '-', '--highlight', 'risk').stdout.includes('#ff0000'))
  assert.ok(!run('export', file, '-o', '-', '--highlight', 'risk=low').stdout.includes('#ff0000'))
})

test('the legend can be left out', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(
    file,
    diagram({ legend: [{ id: 'l', kind: 'entity', label: 'Systems', color: '#336699' }] })
  )
  assert.ok(run('export', file, '-o', '-').stdout.includes('Systems'))
  assert.ok(!run('export', file, '-o', '-', '--no-legend').stdout.includes('Systems'))
})

test('it refuses to write anything but an .svg, so a diagram cannot be overwritten', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  const r = run('export', file, '-o', file)
  assert.equal(r.status, 2)
  assert.match(r.stderr, /must be an \.svg/)
  assert.equal(await readFile(file, 'utf-8'), diagram())
})

test('usage errors exit 2, an unreadable or invalid diagram exits 1', async () => {
  assert.equal(run('export').status, 2)
  assert.equal(run('export', 'x.chd', '--theme', 'purple').status, 2)
  assert.equal(run('export', 'x.chd', '--bogus').status, 2)
  assert.equal(run('export', join(dir, 'missing.chd')).status, 1)
  const bad = join(dir, 'bad.chd')
  await writeFile(bad, '{"not":"a diagram"}')
  const r = run('export', bad)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Not a recognized/)
})

test('a built-in icon is drawn inline as vector', async () => {
  const file = join(dir, 'icons.chd')
  const d = JSON.parse(diagram())
  d.nodes[0].data.icons = { topLeft: { source: 'builtin', id: 'database' } }
  await writeFile(file, JSON.stringify(d))
  const svg = run('export', file, '-o', '-').stdout
  assert.match(svg, /<svg x="[\d.]+" y="[\d.]+" width="18" height="18" viewBox="0 0 24 24"/)
})

test('a custom icon outside the diagram folder is left out with a warning', async () => {
  await mkdir(join(dir, 'sub'))
  await writeFile(join(dir, 'secret.png'), 'not really a png')
  await writeFile(join(dir, 'sub', 'inside.png'), 'png bytes')
  const file = join(dir, 'sub', 'icons.chd')
  const d = JSON.parse(diagram())
  d.nodes[0].data.icons = {
    topLeft: { source: 'custom', path: '../secret.png' },
    topRight: { source: 'custom', path: 'inside.png' }
  }
  await writeFile(file, JSON.stringify(d))
  const r = run('export', file, '-o', '-')
  assert.ok(!r.stdout.includes(Buffer.from('not really a png').toString('base64')))
  assert.ok(r.stdout.includes(Buffer.from('png bytes').toString('base64')))
  assert.match(r.stderr, /icon '\.\.\/secret\.png' skipped/)
})

test('the bundle exists after the build step', async () => {
  assert.ok((await stat(join(root, 'resources', 'cli', 'export.mjs'))).size > 1000)
})

test('help export is the same as export --help', () => {
  const r = run('help', 'export')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, run('export', '--help').stdout)
  assert.match(r.stdout, /Exit codes:/)
})

test('--format drawio writes a .drawio next to the diagram and lists what it could not carry', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(
    file,
    diagram({ legend: [{ id: 'l', label: 'x', kind: 'color', color: '#fff' }] })
  )
  const r = run('export', file, '--format', 'drawio')
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), join(dir, 'arch.drawio'))
  assert.match(r.stderr, /chd: note: the legend is not exported/)
  const xml = await readFile(join(dir, 'arch.drawio'), 'utf-8')
  assert.match(xml, /^<mxfile /)
  assert.match(xml, /label="Alpha"/)
  assert.match(xml, /source="a" target="b"/)
})

test('an output ending in .drawio chooses the draw.io format, and the output stays on stdout for -', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  assert.equal(run('export', file, '-o', join(dir, 'x.drawio')).status, 0)
  assert.match(await readFile(join(dir, 'x.drawio'), 'utf-8'), /<mxGraphModel/)
  const r = run('export', file, '--format', 'drawio', '-o', '-')
  assert.match(r.stdout, /^<mxfile /)
})

test('draw.io export is deterministic and honours --theme and --highlight', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram({ highlights: [{ key: 'risk', value: 'high', color: '#ff0000' }] }))
  const once = run('export', file, '-o', '-', '--format', 'drawio').stdout
  assert.equal(once, run('export', file, '-o', '-', '--format', 'drawio').stdout)
  assert.match(
    run('export', file, '-o', '-', '--format', 'drawio', '--theme', 'dark').stdout,
    /background="#1b1b1f"/
  )
  assert.match(
    run('export', file, '-o', '-', '--format', 'drawio', '--highlight', 'risk').stdout,
    /strokeColor=#ff0000/
  )
})

test('draw.io refuses the SVG-only options and a mismatched output', async () => {
  const file = join(dir, 'arch.chd')
  await writeFile(file, diagram())
  const padded = run('export', file, '--format', 'drawio', '--padding', '8')
  assert.equal(padded.status, 2)
  assert.match(padded.stderr, /--padding only apply to an SVG/)
  const wrong = run('export', file, '--format', 'drawio', '-o', join(dir, 'x.svg'))
  assert.equal(wrong.status, 2)
  assert.match(wrong.stderr, /must be a \.drawio/)
  assert.equal(run('export', file, '--format', 'png').status, 2)
})
