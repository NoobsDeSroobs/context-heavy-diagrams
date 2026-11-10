// Checks an unpacked Linux or macOS build (ADR 0166): the licence files are next to the program,
// `chd --version` prints the package version, and on macOS the app holds both architectures and a
// valid ad-hoc signature. It starts the program only as Node (ADR 0106), which is all a CI runner
// can do without a display. Usage: node scripts/smoke-packaged.mjs
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const problems = []
const note = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) problems.push(what)
}
const run = (command, args, env = {}) =>
  spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, env: { ...process.env, ...env } })

if (process.platform === 'linux') {
  const dir = join('dist', 'linux-unpacked')
  for (const name of ['context-heavy-diagrams', 'chd', 'LICENSE.txt', 'THIRD-PARTY-NOTICES.md']) {
    note(existsSync(join(dir, name)), `present: ${name}`)
  }
  const chd = run(join(dir, 'chd'), ['--version'])
  note(
    chd.stdout?.trim() === version,
    `chd --version prints ${version} (got "${chd.stdout?.trim()}")`
  )
} else if (process.platform === 'darwin') {
  const macDir = readdirSync('dist').find((d) => d.startsWith('mac'))
  const appName = macDir && readdirSync(join('dist', macDir)).find((f) => f.endsWith('.app'))
  note(appName !== undefined, 'a .app was built')
  if (macDir && appName) {
    const app = join('dist', macDir, appName)
    const contents = join(app, 'Contents')
    const exe = join(
      contents,
      'MacOS',
      readdirSync(join(contents, 'MacOS')).find((f) => !f.startsWith('.')) ?? ''
    )
    for (const name of ['LICENSE.txt', 'THIRD-PARTY-NOTICES.md']) {
      note(existsSync(join(contents, 'Resources', name)), `present: Resources/${name}`)
    }
    const archs = run('lipo', ['-archs', exe]).stdout ?? ''
    note(/x86_64/.test(archs) && /arm64/.test(archs), `both architectures (got "${archs.trim()}")`)
    const verify = run('codesign', ['--verify', '--deep', '--strict', app])
    note(verify.status === 0, `the ad-hoc signature is valid (${verify.stderr?.trim() || 'ok'})`)
    const cli = join(contents, 'Resources', 'app.asar.unpacked', 'resources', 'cli', 'chd.mjs')
    const chd = run(exe, [cli, '--version'], { ELECTRON_RUN_AS_NODE: '1' })
    note(
      chd.stdout?.trim() === version,
      `chd --version prints ${version} (got "${chd.stdout?.trim()}")`
    )
  }
} else {
  console.error('This check runs on Linux and macOS; use smoke-installer.mjs on Windows.')
  process.exit(2)
}

if (problems.length > 0) {
  console.error(`\n${problems.length} check(s) failed.`)
  process.exit(1)
}
console.log('\nThe build passed.')
