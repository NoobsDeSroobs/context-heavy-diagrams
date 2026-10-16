// What the Claude Desktop extension may touch (ADR 0110): one user-chosen
// folder, a short list of text file types, never dot-files. There is no
// sandbox around an MCPB server, so every path the assistant supplies goes
// through resolveInFolder before anything is read or written.
import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

// A refusal the assistant should see and can act on, as opposed to a bug.
export class ToolError extends Error {}

// Reading is broad (diagrams, their notes, supporting documents the user put
// there on purpose); writing is narrow and never includes anything runnable.
export const READ_EXTENSIONS = new Set([
  '.chd',
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.csv',
  '.tsv',
  '.yaml',
  '.yml',
  '.xml',
  '.svg',
  '.html',
  '.toml',
  '.ini'
])
export const WRITE_EXTENSIONS = new Set(['.chd', '.md', '.txt', '.svg'])
export const MAX_FILE_BYTES = 5 * 1024 * 1024

function isInside(root, target) {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}

// The folder the user chose, resolved through symlinks once up front so every
// later containment check compares like with like.
export function openFolder(folder) {
  if (typeof folder !== 'string' || folder === '') {
    throw new ToolError('no diagram folder was configured for this extension')
  }
  let root
  try {
    root = realpathSync(folder)
  } catch {
    throw new ToolError(`the configured folder does not exist: ${folder}`)
  }
  if (!statSync(root).isDirectory()) {
    throw new ToolError(`the configured folder is not a folder: ${folder}`)
  }
  return root
}

// kind: 'read' | 'write'. Returns { absolute, relative } (relative uses '/').
// mustExist: true for reads and updates; false when creating a file.
export function resolveInFolder(root, input, kind, { mustExist }) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new ToolError('path is required')
  }
  if (input.includes('\0')) throw new ToolError('path contains an invalid character')

  // Windows-authored separators work the same everywhere.
  const target = resolve(root, input.replaceAll('\\', '/'))
  if (!isInside(root, target)) {
    throw new ToolError('that path is outside the folder this extension may use')
  }
  const rel = relative(root, target)
  const segments = rel.split(sep).filter(Boolean)
  if (segments.length === 0) throw new ToolError('path must name a file inside the folder')
  if (segments.some((s) => s.startsWith('.'))) {
    throw new ToolError('dot-files and dot-folders (such as .env or .git) are never accessed')
  }
  // ':' would only be a Windows alternate data stream here.
  if (segments.some((s) => s.includes(':'))) {
    throw new ToolError('path contains an invalid character')
  }

  const ext = extname(target).toLowerCase()
  const allowed = kind === 'write' ? WRITE_EXTENSIONS : READ_EXTENSIONS
  if (!allowed.has(ext)) {
    throw new ToolError(
      `${ext === '' ? 'files without an extension' : `${ext} files`} cannot be ${kind === 'write' ? 'written' : 'read'} here; allowed: ${[...allowed].join(', ')}`
    )
  }

  if (existsSync(target)) {
    // realpath follows symlinks: a link inside the folder must not lead out.
    if (!isInside(root, realpathSync(target))) {
      throw new ToolError('that path leads outside the folder this extension may use')
    }
  } else if (mustExist) {
    throw new ToolError(`file not found: ${segments.join('/')}`)
  } else {
    // Creating: the nearest folder that already exists has to be inside too.
    let dir = dirname(target)
    while (!existsSync(dir)) dir = dirname(dir)
    if (!isInside(root, realpathSync(dir))) {
      throw new ToolError('that path leads outside the folder this extension may use')
    }
  }
  return { absolute: target, relative: segments.join('/') }
}

export function isDotOrIgnoredEntry(name) {
  return name.startsWith('.') || name === 'node_modules'
}
