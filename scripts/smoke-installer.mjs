// Installs the built Windows installer silently into a scratch folder, checks what it put there,
// runs `chd --version`, and uninstalls again (ADR 0165). The release workflow runs it before it
// publishes anything. Usage: node scripts/smoke-installer.mjs [installer.exe]
// The installer is per-user and writes to HKCU, so run it on a CI runner or a throwaway account:
// it registers an uninstall entry and the .chd association, like a real install.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (process.platform !== 'win32') {
  console.error('The installer smoke test runs on Windows only.')
  process.exit(2)
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const installer = process.argv[2] ?? join('dist', `context-heavy-diagrams-${version}-setup.exe`)
if (!existsSync(installer)) fail(`No installer at ${installer}`)

const dir = join(mkdtempSync(join(tmpdir(), 'chd-smoke-')), 'app')
const problems = []
const note = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) problems.push(what)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

// NSIS wants /D=<folder> last and unquoted; the scratch folder has no spaces.
const install = spawnSync(installer, ['/S', `/D=${dir}`], { timeout: 300_000 })
note(install.status === 0, `silent install exits 0 (got ${install.status ?? install.error})`)

const present = (name) => existsSync(join(dir, name))
for (const name of [
  'context-heavy-diagrams.exe',
  'chd.cmd',
  join('bin', 'chd.cmd'),
  'LICENSE.txt',
  'THIRD-PARTY-NOTICES.md',
  'install-options.json'
]) {
  note(present(name), `installed: ${name}`)
}

// `chd` is the app's own exe run as Node (ADR 0106), so this also proves the exe starts.
const chd = spawnSync('cmd.exe', ['/d', '/c', join(dir, 'chd.cmd'), '--version'], {
  encoding: 'utf8',
  timeout: 60_000
})
note(
  chd.stdout?.trim() === version,
  `chd --version prints ${version} (got "${chd.stdout?.trim()}")`
)

// A silent install leaves the PATH alone (ADR 0162).
const userPath = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], {
  encoding: 'utf8'
}).stdout
note(!userPath?.toLowerCase().includes(dir.toLowerCase()), 'the PATH was not changed')

const uninstaller = existsSync(dir)
  ? readdirSync(dir).find((f) => /^Uninstall .*\.exe$/.test(f))
  : undefined
note(uninstaller !== undefined, 'an uninstaller was installed')
if (uninstaller) {
  // `_?=` makes the uninstaller run in place and wait, instead of copying itself away and
  // returning at once.
  const uninstall = spawnSync(join(dir, uninstaller), ['/S', `_?=${dir}`], { timeout: 300_000 })
  note(
    uninstall.status === 0,
    `silent uninstall exits 0 (got ${uninstall.status ?? uninstall.error})`
  )
  note(!present('context-heavy-diagrams.exe'), 'the program is gone after uninstalling')
}

rmSync(join(dir, '..'), { recursive: true, force: true })
if (problems.length > 0) fail(`\n${problems.length} check(s) failed.`)
console.log('\nThe installer passed.')
