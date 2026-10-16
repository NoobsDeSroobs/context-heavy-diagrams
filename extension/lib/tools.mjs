// The extension's tools as plain functions (ADR 0110), independent of the MCP
// transport so they can be tested directly. Each returns a JSON-able object (or
// a string) and throws ToolError for a refusal the assistant should read.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, extname, join, sep } from 'node:path'
import { validateFile } from '../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import {
  MAX_FILE_BYTES,
  READ_EXTENSIONS,
  ToolError,
  WRITE_EXTENSIONS,
  isDotOrIgnoredEntry,
  resolveInFolder
} from './fileRules.mjs'
import { FINGERPRINT_PATTERN, fingerprint } from './fingerprint.mjs'
import { formatSpec } from './formatSpec.mjs'

const LIST_LIMIT = 300
const LIST_MAX_DEPTH = 8

function staleError(rel) {
  return new ToolError(
    `"${rel}" has changed since you read it, so it was not overwritten. Call read_file again and redo your edit on the new content.`
  )
}

function checkSize(content) {
  if (typeof content !== 'string') throw new ToolError('content must be text')
  if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
    throw new ToolError(`content is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
  }
}

function assertFile(absolute, rel) {
  if (!statSync(absolute).isFile()) throw new ToolError(`"${rel}" is not a file`)
}

// Validates a candidate .chd without a text-taking validator: it goes into a
// hidden temporary file beside the target (so relative paths resolve exactly as
// they will for the real file), which is removed whatever happens.
function validateCandidate(root, targetAbsolute, rel, content) {
  const temp = join(dirname(targetAbsolute), `.chd-validate-${randomUUID()}`)
  writeFileSync(temp, content, 'utf-8')
  try {
    return tidyValidation(root, validateFile(temp, false), temp, rel)
  } finally {
    rmSync(temp, { force: true })
  }
}

// Messages carry absolute paths: show diagram-relative ones instead.
function tidyValidation(root, { errors, warnings }, validatedPath, rel) {
  const tidy = (message) =>
    message.replaceAll(validatedPath, rel).replaceAll(root + sep, '').replaceAll(root, '.')
  return {
    ok: errors.length === 0,
    errors: errors.map(tidy),
    warnings: warnings.map(tidy)
  }
}

function refuseInvalid(rel, validation) {
  return new ToolError(
    `"${rel}" was not written because it has structural errors:\n${validation.errors.join('\n')}`
  )
}

export function createTools({ root, allowUpdate, specSources }) {
  function listFiles() {
    const files = []
    let truncated = false
    const walk = (dir, depth) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (isDotOrIgnoredEntry(entry.name) || entry.isSymbolicLink()) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (depth < LIST_MAX_DEPTH) walk(full, depth + 1)
          continue
        }
        const ext = extname(entry.name).toLowerCase()
        if (!entry.isFile() || !READ_EXTENSIONS.has(ext)) continue
        if (files.length >= LIST_LIMIT) {
          truncated = true
          return
        }
        const stats = statSync(full)
        files.push({
          path: full.slice(root.length + 1).split(sep).join('/'),
          bytes: stats.size,
          modified: stats.mtime.toISOString(),
          writable: WRITE_EXTENSIONS.has(ext)
        })
      }
    }
    walk(root, 0)
    files.sort((a, b) => a.path.localeCompare(b.path))
    return { files, truncated, updatesEnabled: allowUpdate }
  }

  function getFormatSpec({ topic } = {}) {
    try {
      return formatSpec(specSources, topic)
    } catch (error) {
      throw new ToolError(error.message)
    }
  }

  function validateDiagram({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (extname(absolute).toLowerCase() !== '.chd') {
      throw new ToolError('validate_diagram only validates .chd diagram files')
    }
    assertFile(absolute, rel)
    return tidyValidation(root, validateFile(absolute, false), absolute, rel)
  }

  function readFile({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    assertFile(absolute, rel)
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      throw new ToolError(`"${rel}" is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
    }
    const bytes = readFileSync(absolute)
    let content
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new ToolError(`"${rel}" is not valid UTF-8 text`)
    }
    return { path: rel, content, fingerprint: fingerprint(bytes), bytes: bytes.length }
  }

  function createFile({ path, content }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'write', { mustExist: false })
    checkSize(content)
    if (existsSync(absolute)) {
      throw new ToolError(
        `"${rel}" already exists, so it was not overwritten. Choose another name${allowUpdate ? ', or read it and use update_file' : ''}.`
      )
    }
    // First folder this call creates, so a refused create leaves no empty folders behind.
    const createdDir = mkdirSync(dirname(absolute), { recursive: true })
    try {
      let warnings = []
      if (extname(absolute).toLowerCase() === '.chd') {
        const validation = validateCandidate(root, absolute, rel, content)
        if (!validation.ok) throw refuseInvalid(rel, validation)
        warnings = validation.warnings
      }
      try {
        // 'wx' is an exclusive create: it fails if the file appeared meanwhile.
        writeFileSync(absolute, content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if (error.code === 'EEXIST') {
          throw new ToolError(`"${rel}" already exists, so it was not overwritten.`)
        }
        throw error
      }
      return {
        path: rel,
        fingerprint: fingerprint(readFileSync(absolute)),
        warnings
      }
    } catch (error) {
      if (createdDir) rmSync(createdDir, { recursive: true, force: true })
      throw error
    }
  }

  function updateFile({ path, content, base_fingerprint: baseFingerprint }) {
    if (!allowUpdate) {
      throw new ToolError(
        'Updating existing files is turned off for this extension. The user can enable "Allow Claude to modify existing files" in the extension settings; until then use create_file with a new name.'
      )
    }
    const { absolute, relative: rel } = resolveInFolder(root, path, 'write', { mustExist: true })
    assertFile(absolute, rel)
    checkSize(content)
    if (typeof baseFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(baseFingerprint)) {
      throw new ToolError(
        'base_fingerprint is required: pass the fingerprint that read_file (or your last create_file/update_file) returned for this file.'
      )
    }
    if (fingerprint(readFileSync(absolute)) !== baseFingerprint) throw staleError(rel)

    // Written beside the target, then renamed over it: a crash can never leave
    // a half-written diagram.
    const temp = join(dirname(absolute), `.chd-write-${randomUUID()}`)
    writeFileSync(temp, content, 'utf-8')
    try {
      let warnings = []
      if (extname(absolute).toLowerCase() === '.chd') {
        const validation = tidyValidation(root, validateFile(temp, false), temp, rel)
        if (!validation.ok) throw refuseInvalid(rel, validation)
        warnings = validation.warnings
      }
      // Checked again right before replacing; the instant between this and the
      // rename is the one race left (ADR 0110).
      if (fingerprint(readFileSync(absolute)) !== baseFingerprint) throw staleError(rel)
      renameSync(temp, absolute)
      return { path: rel, fingerprint: fingerprint(readFileSync(absolute)), warnings }
    } finally {
      rmSync(temp, { force: true })
    }
  }

  return {
    list_files: listFiles,
    get_format_spec: getFormatSpec,
    validate_diagram: validateDiagram,
    read_file: readFile,
    create_file: createFile,
    update_file: updateFile
  }
}
