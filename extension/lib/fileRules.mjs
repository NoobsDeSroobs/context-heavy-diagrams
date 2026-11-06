// What the Claude Desktop extension may touch (ADR 0110): one user-chosen
// folder, any file to read except a short blacklist, a short list of text file
// types to write, never dot-files. There is no
// sandbox around an MCPB server, so every path the assistant supplies goes
// through resolveInFolder before anything is read or written.
import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

// A refusal the assistant should see and can act on, as opposed to a bug.
export class ToolError extends Error {}

// Reading is open (diagrams, their notes, source code, PDFs, screenshots, spreadsheets: whatever
// the user put there on purpose) except the most common dangerous or costly types, which no task
// needs; writing is narrow and never includes anything runnable.
export const READ_BLOCKED_EXTENSIONS = new Set([
  // executables, libraries, installers and packages
  '.exe',
  '.dll',
  '.msi',
  '.msix',
  '.com',
  '.scr',
  '.sys',
  '.so',
  '.dylib',
  '.bin',
  '.apk',
  '.ipa',
  '.jar',
  '.class',
  '.deb',
  '.rpm',
  '.pkg',
  '.dmg',
  '.appimage',
  // archives and disk images
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
  '.zst',
  '.iso',
  '.img',
  '.vhd',
  '.vhdx',
  '.vmdk',
  // video and audio
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.webm',
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.m4a'
])
export const WRITE_EXTENSIONS = new Set(['.chd', '.md', '.txt', '.svg'])
// The one extra file type that can be written: a diagram metamodel, validated before it is written
// (ADR 0143). A metamodel under its old name (.chdprofile.json) can still be read, as any .json can.
export const METAMODEL_SUFFIX = '.chdmeta'
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export function isMetamodelName(name) {
  return name.toLowerCase().endsWith(METAMODEL_SUFFIX)
}

export function isWritableName(name) {
  return WRITE_EXTENSIONS.has(extname(name).toLowerCase()) || isMetamodelName(name)
}

export function isReadBlockedName(name) {
  return READ_BLOCKED_EXTENSIONS.has(extname(name).toLowerCase())
}

// Pictures a client shows as pictures; every other binary file goes out as an embedded resource.
export const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.epub': 'application/epub+zip'
}

export function mimeTypeOf(name) {
  return MIME_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream'
}

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
  const writing = kind === 'write'
  if (writing && !isWritableName(target)) {
    throw new ToolError(
      `${ext === '' ? 'files without an extension' : `${ext} files`} cannot be written here; allowed: ${[...WRITE_EXTENSIONS, METAMODEL_SUFFIX].join(', ')}`
    )
  }
  if (!writing && isReadBlockedName(target)) {
    throw new ToolError(
      `${ext} files cannot be read here: executables, installers, archives, disk images, video and audio are blocked`
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
