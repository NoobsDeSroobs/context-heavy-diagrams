// Generates THIRD-PARTY-NOTICES.md at the repo root: the name, version, license and
// full license text of every third-party package that ships in the app (ADR 0119).
//
//   npm run notices           rewrite the file
//   npm run notices -- --check   exit 1 if the committed file is out of date (npm test does this)
//
// "Ships" means:
//   - the app: the `dependencies` in package.json plus react and react-dom (the
//     renderer bundles them although they are listed as devDependencies), and
//     everything those need at runtime, found by reading each package's own
//     `dependencies` (optional and peer dependencies are not followed);
//   - the Claude Desktop extension: the packages esbuild really pulls into the bundle
//     (read from its metafile), because that bundle is a separate shipped artifact.
// Electron and Chromium carry their own notices (LICENSE.electron.txt and
// LICENSES.chromium.html), which electron-builder places next to the executable.
//
// Every license found is checked against an allowlist of licenses compatible with
// GPL-3.0-or-later; anything else fails the run so a new dependency cannot slip in
// unreviewed.
import { build } from 'esbuild'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const NOTICES_FILE = join(root, 'THIRD-PARTY-NOTICES.md')

// SPDX ids that may be combined into a GPL-3.0-or-later work. Apache-2.0 is fine for
// GPLv3 (not GPLv2); MPL-2.0 is fine through its secondary-license clause; Python-2.0 is
// listed by the FSF as GPL-compatible.
const COMPATIBLE = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'MPL-2.0',
  'BlueOak-1.0.0',
  'Python-2.0',
  'CC0-1.0',
  'Unlicense',
  'GPL-3.0-or-later',
  'LGPL-3.0-or-later'
])

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const rootPkg = readJson(join(root, 'package.json'))

// Node's own lookup: the package's node_modules, then each parent's.
function locate(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dirname(dir) === dir) throw new Error(`cannot resolve ${name} from ${fromDir}`)
  }
}

function collectApp() {
  const found = new Map() // dir -> package.json
  const walk = (name, fromDir) => {
    const dir = locate(name, fromDir)
    if (found.has(dir)) return
    const pkg = readJson(join(dir, 'package.json'))
    found.set(dir, pkg)
    for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep, dir)
  }
  for (const name of [...Object.keys(rootPkg.dependencies ?? {}), 'react', 'react-dom'])
    walk(name, root)
  return found
}

async function collectExtension() {
  const result = await build({
    entryPoints: [join(root, 'extension', 'server.mjs')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent'
  })
  const found = new Map()
  for (const input of Object.keys(result.metafile.inputs)) {
    const parts = input.split(/[\\/]/)
    const at = parts.lastIndexOf('node_modules')
    if (at < 0) continue
    const name = parts[at + 1].startsWith('@') ? `${parts[at + 1]}/${parts[at + 2]}` : parts[at + 1]
    const dir = resolve(root, ...parts.slice(0, at + 1), ...name.split('/'))
    if (!found.has(dir)) found.set(dir, readJson(join(dir, 'package.json')))
  }
  return found
}

function licenseId(pkg) {
  const l = pkg.license ?? (Array.isArray(pkg.licenses) ? pkg.licenses[0]?.type : undefined)
  return typeof l === 'object' ? l?.type : l
}

// "(MIT OR Apache-2.0)" is fine when at least one alternative is acceptable; an AND
// needs every part acceptable.
function compatible(expr) {
  const text = String(expr).replace(/[()]/g, ' ')
  if (/\bAND\b/.test(text)) return text.split(/\bAND\b/).every((p) => compatible(p.trim()))
  return text.split(/\bOR\b/).some((p) => COMPATIBLE.has(p.trim()))
}

function licenseTexts(dir) {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^(licen[sc]e|copying|notice)(\.|-|$)/i.test(e.name))
    .map((e) => e.name)
    .sort()
  return files.map((f) => ({
    file: f,
    text: readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n').trim()
  }))
}

function author(pkg) {
  const a = pkg.author
  return typeof a === 'string' ? a : a?.name
}

export async function generate() {
  const app = collectApp()
  const extension = await collectExtension()
  const all = new Map([...app, ...extension])
  const inExtensionOnly = new Set([...extension.keys()].filter((d) => !app.has(d)))

  const entries = [...all].map(([dir, pkg]) => ({
    name: pkg.name,
    version: pkg.version,
    license: licenseId(pkg),
    repo: (typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? ''))
      .replace(/^git\+/, '')
      .replace(/\.git$/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^github:/, 'https://github.com/'),
    author: author(pkg),
    onlyExtension: inExtensionOnly.has(dir),
    texts: licenseTexts(dir),
    dir
  }))
  entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

  const problems = []
  for (const e of entries) {
    if (!e.license) problems.push(`${e.name}@${e.version}: no license field`)
    else if (!compatible(e.license))
      problems.push(`${e.name}@${e.version}: license "${e.license}" is not on the allowlist`)
    if (e.texts.length === 0)
      problems.push(`${e.name}@${e.version}: no license file in the package (add by hand)`)
  }

  // Tabler is bundled as data, not imported code, so it is named explicitly.
  const out = []
  out.push('# Third-party notices', '')
  out.push(
    'Context Heavy Diagrams is licensed under GPL-3.0-or-later (see `LICENSE`). It includes the third-party software below, each under its own license, which is reproduced here as those licenses require.',
    '',
    'This file is generated by `npm run notices` from the dependency tree and is checked by `npm test`; do not edit it by hand. Packages that ship only inside the optional Claude Desktop extension, not in the app itself, are marked.',
    ''
  )
  out.push('## Electron and Chromium', '')
  out.push(
    'The application runs on [Electron](https://www.electronjs.org/) (MIT), which bundles Chromium and Node.js. Their licenses ship with every build as `LICENSE.electron.txt` and `LICENSES.chromium.html`, next to the executable.',
    ''
  )
  out.push('## Icons', '')
  out.push(
    'The built-in icon set is [Tabler Icons](https://tabler.io/icons) (`@tabler/icons`, MIT, copyright Paweł Kuna), listed with its license text below. The outline icons are loaded from the package at build time.',
    ''
  )
  out.push('## Summary', '', '| Package | Version | License |', '|---|---|---|')
  for (const e of entries)
    out.push(
      `| ${e.name}${e.onlyExtension ? ' (extension only)' : ''} | ${e.version} | ${e.license} |`
    )
  out.push('')
  out.push('## License texts', '')
  for (const e of entries) {
    out.push(`### ${e.name} ${e.version}`, '')
    const meta = [`License: ${e.license}`]
    if (e.author) meta.push(`Author: ${e.author}`)
    if (e.repo) meta.push(`Source: ${e.repo}`)
    if (e.onlyExtension) meta.push('Ships only in the Claude Desktop extension')
    out.push(meta.join('  \n'), '')
    for (const t of e.texts) {
      out.push(e.texts.length > 1 ? `\`${t.file}\`` : '', '```text', t.text, '```', '')
    }
  }
  return {
    markdown: out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n',
    problems,
    count: entries.length
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const { markdown, problems, count } = await generate()
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  if (check) {
    const current = existsSync(NOTICES_FILE)
      ? readFileSync(NOTICES_FILE, 'utf8').replace(/\r\n/g, '\n')
      : ''
    if (current !== markdown) {
      console.error('THIRD-PARTY-NOTICES.md is out of date. Run `npm run notices`.')
      process.exit(1)
    }
    console.log(`notices up to date (${count} packages)`)
  } else {
    writeFileSync(NOTICES_FILE, markdown)
    console.log(`wrote ${NOTICES_FILE} (${count} packages)`)
  }
}
