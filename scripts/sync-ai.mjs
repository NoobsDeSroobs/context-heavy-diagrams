// Refreshes the repo's own Claude Code copy of the skill (.claude/skills) from
// its source of truth, resources/ai/skills (ADR 0105). Edit the source, run
// `npm run sync-ai`; `npm test` fails if the two drift apart.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'resources', 'ai', 'skills', 'chd-diagrams')
const to = join(root, '.claude', 'skills', 'chd-diagrams')

rmSync(to, { recursive: true, force: true })
mkdirSync(dirname(to), { recursive: true })
cpSync(from, to, { recursive: true })
console.log(`synced ${from} -> ${to}`)
