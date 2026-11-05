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
import { basename, dirname, extname, join, sep } from 'node:path'
import { parseDiagram } from '../../src/shared/diagram/index.ts'
import { metamodelFileBase } from '../../src/shared/conformance/metamodel.ts'
import {
  checkDiagramText,
  metamodelProblems,
  parseMetamodelText
} from '../../src/shared/conformance/report.ts'
import { compareDiagrams, diffToJson, notesBetween } from '../../src/shared/compare/report.ts'
// The same containment rule the command line applies to a stored note path (ADR 0115).
import { containedPath } from '../../src/main/containedPath.ts'
// The one place the extension starts another program: `git show <revision>:<file>`, read-only
// (ADR 0142).
import { buildGitSession } from '../../src/main/compare/gitCompare.ts'
import { validateFile } from '../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import {
  MAX_FILE_BYTES,
  METAMODEL_SUFFIX,
  READ_EXTENSIONS,
  ToolError,
  isDotOrIgnoredEntry,
  isMetamodelName,
  isWritableName,
  resolveInFolder
} from './fileRules.mjs'
import { FINGERPRINT_PATTERN, fingerprint } from './fingerprint.mjs'
import { formatSpec } from './formatSpec.mjs'
import { loadBuiltinMetamodels } from './metamodelsText.mjs'

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
    message
      .replaceAll(validatedPath, rel)
      .replaceAll(root + sep, '')
      .replaceAll(root, '.')
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

// A metamodel is checked from its text, with the same reader `chd check` uses; it holds no relative
// paths, so unlike a diagram it needs no temporary file (ADR 0143).
function refuseInvalidMetamodel(rel, content) {
  const loaded = parseMetamodelText(content, basename(rel))
  if ('message' in loaded) {
    throw new ToolError(`"${rel}" was not written. ${loaded.message}`)
  }
}

export function createTools({ root, allowUpdate, specSources }) {
  const builtinMetamodels = loadBuiltinMetamodels()

  // The text of a file the assistant named, refused if it is too large or not UTF-8 text.
  function textOf(absolute, rel) {
    assertFile(absolute, rel)
    if (statSync(absolute).size > MAX_FILE_BYTES) {
      throw new ToolError(`"${rel}" is larger than the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit`)
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(absolute))
    } catch {
      throw new ToolError(`"${rel}" is not valid UTF-8 text`)
    }
  }

  // A .chd the assistant named, as { absolute, rel, text }.
  function diagramFile(path, tool) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (extname(absolute).toLowerCase() !== '.chd') {
      throw new ToolError(`${tool} only works on .chd diagram files`)
    }
    return { absolute, rel, text: textOf(absolute, rel) }
  }

  function parsed(file) {
    try {
      return parseDiagram(file.text)
    } catch (error) {
      throw new ToolError(`can't read '${file.rel}': ${error?.message ?? error}`)
    }
  }

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
          path: full
            .slice(root.length + 1)
            .split(sep)
            .join('/'),
          bytes: stats.size,
          modified: stats.mtime.toISOString(),
          writable: isWritableName(entry.name)
        })
      }
    }
    walk(root, 0)
    files.sort((a, b) => a.path.localeCompare(b.path))
    // The folder's name only, never its full path (which would go to the provider): enough for an
    // assistant to notice that the server points at the wrong folder.
    return { folder: basename(root), files, truncated, updatesEnabled: allowUpdate }
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

  // `chd validate` on a metamodel file: the same list of problems, from the shared reader. A
  // metamodel under its old name (.chdprofile.json) is read too.
  function validateMetamodel({ path }) {
    const { absolute, relative: rel } = resolveInFolder(root, path, 'read', { mustExist: true })
    if (metamodelFileBase(rel) === null) {
      throw new ToolError('validate_metamodel only validates .chdmeta metamodel files')
    }
    const errors = metamodelProblems(textOf(absolute, rel))
    return { ok: errors.length === 0, errors, warnings: [] }
  }

  // `chd check` (ADR 0131): the same shared code, so the same result as `chd check --json` for one
  // file. A metamodel is a built-in one by name, or a .chdmeta file in the folder.
  function checkDiagram({ path, metamodel }) {
    const file = diagramFile(path, 'check_diagram')
    const builtIn = Object.keys(builtinMetamodels)
    if (typeof metamodel !== 'string' || metamodel.trim() === '') {
      throw new ToolError(
        `metamodel is required: the name of a built-in metamodel (${builtIn.join(', ')}) or the path of a ${METAMODEL_SUFFIX} file in the folder`
      )
    }
    let metamodelText
    let metamodelName
    if (Object.hasOwn(builtinMetamodels, metamodel)) {
      metamodelText = builtinMetamodels[metamodel]
      metamodelName = metamodel + METAMODEL_SUFFIX
    } else {
      const unknown = new ToolError(
        `no metamodel called '${metamodel}': use a built-in metamodel (${builtIn.join(', ')}) or the path of a ${METAMODEL_SUFFIX} file in the folder`
      )
      let found
      try {
        found = resolveInFolder(root, metamodel, 'read', { mustExist: false })
      } catch {
        throw unknown
      }
      if (metamodelFileBase(found.relative) === null || !existsSync(found.absolute)) throw unknown
      metamodelText = textOf(found.absolute, found.relative)
      metamodelName = basename(found.relative)
    }
    const loaded = parseMetamodelText(metamodelText, metamodelName)
    if ('message' in loaded) throw new ToolError(loaded.message)
    parsed(file)
    return { file: file.rel, result: checkDiagramText(file.text, loaded.metamodel) }
  }

  // The text of a note beside a diagram, or null if it is not there or may not be read: a stored
  // path leaving the diagram's folder is never read (ADR 0115), and the folder rules still apply.
  function noteBeside(diagramAbsolute, stored) {
    const full = containedPath(dirname(diagramAbsolute), stored)
    return full === null ? null : noteOnDisk(full)
  }

  // `chd diff` (ADR 0137): the same shared code, so the same result as `chd diff --json`. The
  // earlier version is a second file in the folder, or the same file in git at a revision
  // (`chd diff <file> --rev`, ADR 0142).
  async function diffDiagrams({ old_path: oldPath, new_path: newPath, revision, match }) {
    if (typeof newPath !== 'string' || newPath.trim() === '') {
      throw new ToolError(
        'new_path is required: the later version, or the file on disk when comparing with git'
      )
    }
    const hasOld = typeof oldPath === 'string' && oldPath.trim() !== ''
    if (hasOld && revision !== undefined) {
      throw new ToolError('give old_path (a second file) or revision (the file in git), not both')
    }
    const newer = diagramFile(newPath, 'diff_diagrams')
    if (!hasOld) return diffWithGit(newer, revision ?? 'HEAD', match === true)
    const older = diagramFile(oldPath, 'diff_diagrams')
    const olderDiagram = parsed(older)
    const newerDiagram = parsed(newer)
    const notes = notesBetween(olderDiagram, newerDiagram, {
      before: (stored) => noteBeside(older.absolute, stored),
      after: (stored) => noteBeside(newer.absolute, stored)
    })
    return diffToJson(
      compareDiagrams(olderDiagram, newerDiagram, {
        olderName: older.rel,
        newerName: newer.rel,
        match: match === true,
        notes
      })
    )
  }

  // The file on disk against the same file at a git revision. Git is asked for that one file only,
  // and the note files on disk are read under the folder rules (ADR 0142).
  async function diffWithGit(newer, revision, match) {
    if (typeof revision !== 'string') throw new ToolError('revision must be text')
    const result = await buildGitSession(newer.absolute, revision, {
      allowed: noteMayBeRead,
      read: noteOnDisk
    })
    if (!result.ok) throw new ToolError(result.message)
    const { base, next, notesContent } = result.session
    const name = basename(newer.rel)
    return diffToJson(
      compareDiagrams(base, next, {
        olderName: `${name} at ${revision}`,
        newerName: `${name} on disk`,
        match,
        notes: notesContent ?? {}
      })
    )
  }

  // Whether the folder rules allow reading a note at all, whether or not it exists now (git may
  // still have it).
  function noteMayBeRead(absolute) {
    try {
      resolveInFolder(root, absolute, 'read', { mustExist: false })
      return true
    } catch {
      return false
    }
  }

  // A note on disk under the folder rules, or null.
  function noteOnDisk(absolute) {
    try {
      const found = resolveInFolder(root, absolute, 'read', { mustExist: true })
      return textOf(found.absolute, found.relative)
    } catch {
      return null
    }
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
      } else if (isMetamodelName(absolute)) {
        refuseInvalidMetamodel(rel, content)
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
      } else if (isMetamodelName(absolute)) {
        refuseInvalidMetamodel(rel, content)
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
    validate_metamodel: validateMetamodel,
    check_diagram: checkDiagram,
    diff_diagrams: diffDiagrams,
    read_file: readFile,
    create_file: createFile,
    update_file: updateFile
  }
}
