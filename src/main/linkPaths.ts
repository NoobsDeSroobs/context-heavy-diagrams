import { dirname, isAbsolute, join } from 'path'

// Resolve a relative resource path (a `linkedDiagram`, a custom icon, a
// reference image, a details `.md`) stored on a diagram element to an
// absolute filesystem path. All of them share the same convention: a path
// relative to the diagram *file's own directory*.
//
//  - A stored path can legitimately already be absolute (`path.relative()`
//    falls back to an absolute path across Windows drives), so a bare
//    `join()` would mangle it — check `isAbsolute` first.
//  - A stored path may use '\' separators (written by an older build, or
//    hand-edited on Windows) and still needs to resolve when this runs on
//    Linux, where `join` treats '\' as a literal filename character — so
//    split on either separator before joining.
//
// Single source of truth: link following (windows.ts), required-tag
// propagation (requiredTags.ts), the missing-file check (links.ts) and the
// icon/details readers must all resolve a stored path the same way.
export function resolveLinkPath(diagramPath: string, relativePath: string): string {
  return isAbsolute(relativePath)
    ? relativePath
    : join(dirname(diagramPath), ...relativePath.split(/[\\/]/))
}
