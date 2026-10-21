import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { AiFolderResult } from '../../shared/ai/aiFolderResult'

// Writes the bundled AI material (resources/ai, ADR 0105) into a user-chosen
// folder: AGENTS.md, CLAUDE.md and the chd-diagrams skill under
// .claude/skills. Everything we write carries AI_MARKER (a comment in the .md
// files, a stamp file inside the skill folder), and that marker is the only
// thing that lets a later run overwrite it: an existing file WITHOUT the marker
// belongs to the user and is skipped, never replaced.
export const AI_MARKER = 'chd-ai-managed'
const SKILL_NAME = 'chd-diagrams'
const SKILL_STAMP = `.${AI_MARKER}`

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

// Names + stat rather than readdir({ withFileTypes }) — the source dir lives
// inside app.asar when packaged, where the plainer calls are the safe ones.
async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (const name of await readdir(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name
    if ((await stat(join(dir, name))).isDirectory())
      out.push(...(await listFiles(join(dir, name), rel)))
    else out.push(rel)
  }
  return out
}

// Filled into AGENTS.md's {{CLI_NOTE}} when the app knows where its `chd`
// launcher is (ADR 0106). Absent (empty) in dev builds and AppImages, where
// there is no stable path to point at.
function cliNote(cliPath: string | undefined): string {
  if (!cliPath) return ''
  return `The Context Heavy Diagrams app also installs a command-line tool that needs no Node install. It does the same checks as the script above, and can print the full format reference:

\`\`\`bash
"${cliPath}" validate path/to/diagram.chd
"${cliPath}" spec
\`\`\`

(In PowerShell, put \`&\` in front of the quoted path. If the app has been moved or reinstalled, the path may have changed — the user can re-run "Enable AI assistance" in the app to refresh this file.)

`
}

async function installMarkdown(
  sourceDir: string,
  targetDir: string,
  name: string,
  appVersion: string,
  cliPath: string | undefined,
  result: AiFolderResult
): Promise<void> {
  const target = join(targetDir, name)
  const had = await exists(target)
  if (had && !(await readFile(target, 'utf-8')).includes(AI_MARKER)) {
    result.skipped.push(name)
    return
  }
  const template = await readFile(join(sourceDir, name), 'utf-8')
  // The placeholder owns its trailing blank line, so an empty note leaves no gap.
  const text = template
    .replaceAll('{{VERSION}}', appVersion)
    .replace(/\{\{CLI_NOTE\}\}\r?\n\r?\n/, () => cliNote(cliPath))
  await writeFile(target, text, 'utf-8')
  ;(had ? result.updated : result.added).push(name)
}

async function installSkill(
  sourceDir: string,
  targetDir: string,
  appVersion: string,
  result: AiFolderResult
): Promise<void> {
  const rel = `.claude/skills/${SKILL_NAME}`
  const skillTarget = join(targetDir, '.claude', 'skills', SKILL_NAME)
  const skillSource = join(sourceDir, 'skills', SKILL_NAME)
  const had = await exists(skillTarget)
  if (had && !(await exists(join(skillTarget, SKILL_STAMP)))) {
    result.skipped.push(rel)
    return
  }
  // Stamped means ours: replace wholesale so files removed in a newer
  // version (e.g. the old Python validator) don't linger.
  if (had) await rm(skillTarget, { recursive: true, force: true })
  for (const file of await listFiles(skillSource)) {
    const dest = join(skillTarget, ...file.split('/'))
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, await readFile(join(skillSource, ...file.split('/'))))
  }
  await writeFile(join(skillTarget, SKILL_STAMP), `${AI_MARKER} v${appVersion}\n`, 'utf-8')
  ;(had ? result.updated : result.added).push(rel)
}

export async function installAiFiles(
  sourceDir: string,
  targetDir: string,
  appVersion: string,
  cliPath?: string
): Promise<AiFolderResult> {
  const result: AiFolderResult = { folder: targetDir, added: [], updated: [], skipped: [] }
  await installMarkdown(sourceDir, targetDir, 'AGENTS.md', appVersion, cliPath, result)
  await installMarkdown(sourceDir, targetDir, 'CLAUDE.md', appVersion, cliPath, result)
  await installSkill(sourceDir, targetDir, appVersion, result)
  return result
}
