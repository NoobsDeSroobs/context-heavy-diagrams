// Builds the Claude Desktop extension (ADR 0110): bundles extension/server.mjs
// into one self-contained file with the spec text inlined, stages it with the
// manifest, validates and packs it with the `mcpb` CLI into
// resources/extension/context-heavy-diagrams.mcpb, and leaves the bundle itself
// beside it as server.mjs for `chd mcp` (both git-ignored; shipped inside
// the app like the rest of resources/). Run by `npm run build:extension`, which
// the app build runs first. Exports bundleServer so the tests can exercise the
// real bundle.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const EXTENSION_FILE = join(root, 'resources', 'extension', 'context-heavy-diagrams.mcpb')
// The same bundle the package holds, unpacked, for `chd mcp` (ADR 0110): any MCP client can start it.
export const SERVER_FILE = join(root, 'resources', 'extension', 'server.mjs')

// Swaps the disk-reading spec module for one with the text baked in.
const inlineSpec = {
  name: 'inline-spec',
  setup(b) {
    b.onLoad({ filter: /extension[\\/]lib[\\/]specText\.mjs$/ }, async () => {
      const { SPEC_FILES, loadSpecSources } = await import(
        pathToFileURL(join(root, 'extension', 'lib', 'specText.mjs')).href
      )
      return {
        loader: 'js',
        contents: `export const SPEC_FILES = ${JSON.stringify(SPEC_FILES)};\nexport function loadSpecSources() { return ${JSON.stringify(loadSpecSources())}; }`
      }
    })
  }
}

// Swaps the disk-reading metamodel module for one with the built-in metamodels baked in.
const inlineMetamodels = {
  name: 'inline-metamodels',
  setup(b) {
    b.onLoad({ filter: /extension[\\/]lib[\\/]metamodelsText\.mjs$/ }, async () => {
      const { loadBuiltinMetamodels } = await import(
        pathToFileURL(join(root, 'extension', 'lib', 'metamodelsText.mjs')).href
      )
      return {
        loader: 'js',
        contents: `export function loadBuiltinMetamodels() { return ${JSON.stringify(loadBuiltinMetamodels())}; }`
      }
    })
  }
}

// The version with the commit the server was built from, as semver build metadata: `0.10.0+c1f085e`, and
// `.dirty` when the tree has changes. Before a release the package version does not change from build to
// build, so this is what tells two installed builds apart. Without git the version stands alone.
function buildVersion(version) {
  try {
    const git = (...args) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      })
    const commit = git('rev-parse', '--short', 'HEAD').trim()
    const dirty = git('status', '--porcelain').trim() !== ''
    return `${version}+${commit}${dirty ? '.dirty' : ''}`
  } catch {
    return version
  }
}

export async function bundleServer(outfile, version = '0.0.0') {
  await build({
    entryPoints: [join(root, 'extension', 'server.mjs')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile,
    logLevel: 'warning',
    // Some bundled dependencies are CommonJS and call require().
    banner: {
      js: "import { createRequire as __chdCreateRequire } from 'node:module';\nconst require = __chdCreateRequire(import.meta.url);"
    },
    define: { 'process.env.CHD_EXTENSION_VERSION': JSON.stringify(version) },
    plugins: [inlineSpec, inlineMetamodels]
  })
}

function mcpb(...args) {
  // Read directly: the package's exports map does not expose package.json.
  const pkgPath = join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.mcpb
  execFileSync(process.execPath, [join(dirname(pkgPath), bin), ...args], { stdio: 'inherit' })
}

export async function buildExtension() {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version
  const staging = join(root, 'out', 'extension-staging')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(join(staging, 'server'), { recursive: true })

  await bundleServer(join(staging, 'server', 'index.mjs'), buildVersion(version))
  mkdirSync(dirname(SERVER_FILE), { recursive: true })
  copyFileSync(join(staging, 'server', 'index.mjs'), SERVER_FILE)

  const manifest = JSON.parse(readFileSync(join(root, 'extension', 'manifest.json'), 'utf-8'))
  manifest.version = version
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  copyFileSync(join(root, 'resources', 'icon.png'), join(staging, 'icon.png'))

  mkdirSync(dirname(EXTENSION_FILE), { recursive: true })
  mcpb('validate', join(staging, 'manifest.json'))
  mcpb('pack', staging, EXTENSION_FILE)
  console.log(`built ${EXTENSION_FILE}\nbuilt ${SERVER_FILE}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildExtension()
}
