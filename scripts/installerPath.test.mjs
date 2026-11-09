// The installer's PATH functions (build/chdPath.nsh, ADR 0162), compiled with the NSIS that
// electron-builder downloads and run against a scratch registry key, never the real PATH.
// Skipped off Windows, and where electron-builder has not downloaded NSIS yet (any `npm run
// build:win` fetches it).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const here = import.meta.dirname
const cache = join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'nsis-3.0.4.1')
const makensis = existsSync(cache)
  ? readdirSync(cache)
      .map((name) => join(cache, name, 'makensis.exe'))
      .find((file) => existsSync(file))
  : undefined
const skip =
  process.platform !== 'win32' ? 'Windows only' : !makensis ? 'NSIS is not cached' : false

const KEY = `Software\\ChdPathTest-${process.pid}`
const FOLDER = 'C:\\Apps\\Chd\\bin'

const work = skip ? '' : mkdtempSync(join(tmpdir(), 'chd-nsis-'))
const exe = join(work, 'run.exe')

function build() {
  const script = [
    'Unicode true',
    'Name "ChdPathTest"',
    `OutFile "${exe}"`,
    'RequestExecutionLevel user',
    'SilentInstall silent',
    '!define CHD_ENV_ROOT HKCU',
    `!define CHD_ENV_KEY "${KEY}"`,
    `!include "${join(here, '..', 'build', 'chdPath.nsh')}"`,
    '!insertmacro ChdPathRemove ""',
    '!insertmacro ChdPathAdd',
    'Section',
    '  FileOpen $0 "$EXEDIR\\op.txt" r',
    '  FileRead $0 $1',
    '  FileClose $0',
    '  Push "' + FOLDER + '"',
    '  ${If} $1 == "add"',
    '    Call ChdPathAdd',
    '  ${Else}',
    '    Call ChdPathRemove',
    '  ${EndIf}',
    'SectionEnd',
    ''
  ].join('\r\n')
  writeFileSync(join(work, 'run.nsi'), script)
  // -WX: warnings are errors, as in the installer build, so an unused function fails here too.
  execFileSync(makensis, ['-V2', '-WX', join(work, 'run.nsi')], { stdio: 'pipe' })
}

const reg = (...args) => execFileSync('reg.exe', args, { stdio: 'pipe' }).toString()
function setPath(value, type = 'REG_EXPAND_SZ') {
  reg('add', `HKCU\\${KEY}`, '/v', 'Path', '/t', type, '/d', value, '/f')
}
function getPath() {
  try {
    const out = reg('query', `HKCU\\${KEY}`, '/v', 'Path')
    const match = /Path\s+(REG_\w+)\s*(.*)\r?\n/.exec(out)
    return match ? { type: match[1], value: match[2] } : null
  } catch {
    return null
  }
}
function run(op) {
  writeFileSync(join(work, 'op.txt'), op)
  execFileSync(exe, [], { stdio: 'pipe' })
}
function fresh() {
  try {
    reg('delete', `HKCU\\${KEY}`, '/f')
  } catch {
    // not there yet
  }
  reg('add', `HKCU\\${KEY}`, '/f')
}

test('the PATH functions', { skip }, async (t) => {
  build()
  t.after(() => {
    try {
      reg('delete', `HKCU\\${KEY}`, '/f')
    } catch {
      // already gone
    }
    rmSync(work, { recursive: true, force: true })
  })

  await t.test('add to a missing PATH makes it the folder', () => {
    fresh()
    run('add')
    assert.deepEqual(getPath(), { type: 'REG_EXPAND_SZ', value: FOLDER })
  })

  await t.test('add appends, keeps %VARIABLE% entries unexpanded and the type expandable', () => {
    fresh()
    setPath('C:\\a;%USERPROFILE%\\bin')
    run('add')
    assert.deepEqual(getPath(), {
      type: 'REG_EXPAND_SZ',
      value: `C:\\a;%USERPROFILE%\\bin;${FOLDER}`
    })
  })

  await t.test('add after a trailing semicolon does not double it, and twice adds once', () => {
    fresh()
    setPath('C:\\a;')
    run('add')
    run('add')
    assert.equal(getPath().value, `C:\\a;${FOLDER}`)
  })

  await t.test('remove takes out only the folder, whatever its case, and keeps the rest', () => {
    fresh()
    setPath(`C:\\a;;${FOLDER.toUpperCase()};%USERPROFILE%\\bin;C:\\b`)
    run('remove')
    assert.deepEqual(getPath(), { type: 'REG_EXPAND_SZ', value: 'C:\\a;;%USERPROFILE%\\bin;C:\\b' })
  })

  await t.test('remove from a PATH that does not hold it leaves value and type alone', () => {
    fresh()
    setPath('C:\\a;C:\\b', 'REG_SZ')
    run('remove')
    assert.deepEqual(getPath(), { type: 'REG_SZ', value: 'C:\\a;C:\\b' })
  })

  await t.test('remove of the only entry deletes the value', () => {
    fresh()
    setPath(FOLDER)
    run('remove')
    assert.equal(getPath(), null)
  })

  await t.test('a PATH too long for NSIS strings is left as it is', () => {
    fresh()
    const long = Array.from({ length: 1200 }, (_, i) => `C:\\dir${i}`).join(';')
    setPath(long)
    run('add')
    assert.equal(getPath().value, long)
    run('remove')
    assert.equal(getPath().value, long)
  })
})
