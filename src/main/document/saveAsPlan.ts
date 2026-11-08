import { readFile, stat } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { parseDiagram, serializeDiagram } from '../../shared/diagram/index.ts'
import {
  planSaveAsCopy,
  type PlanSaveAsRequest,
  type SaveAsPlan
} from '../../shared/document/saveAsCopy.ts'
import { containedPath } from '../containedPath.ts'

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const samePath = (a: string, b: string): boolean =>
  process.platform === 'win32'
    ? resolve(a).toLowerCase() === resolve(b).toLowerCase()
    : resolve(a) === resolve(b)

// What a Save As would copy, and whether it can be made at all (docs/decisions/0160). Used for the
// dialog's preview and again, fresh, when the person confirms.
export async function planSaveAs(req: PlanSaveAsRequest): Promise<SaveAsPlan> {
  // The old folder is only ever read; the plan names what to write in the new one.
  const oldDir = dirname(req.currentPath)
  const newFileName = basename(req.newPath)
  const newBase = newFileName.slice(0, newFileName.lastIndexOf('.'))
  const inOld = (rel: string): string | null => containedPath(oldDir, rel)

  const plan = await planSaveAsCopy({
    oldFileName: basename(req.currentPath),
    newFileName,
    rootNodes: req.nodes,
    options: req.options,
    io: {
      exists: async (rel) => {
        const path = inOld(rel)
        return path !== null && (await exists(path))
      },
      readDiagram: async (rel) => {
        const path = inOld(rel)
        if (path === null) return null
        try {
          return parseDiagram(await readFile(path, 'utf-8'))
        } catch {
          return null
        }
      },
      serialize: serializeDiagram
    }
  })

  const newDir = dirname(req.newPath)
  if (!/\.chd$/i.test(newFileName) || newBase === '') {
    plan.problems.push('The file name must end in .chd.')
  } else if (samePath(req.newPath, req.currentPath)) {
    plan.problems.push('That is the diagram you are editing. Choose another name.')
  } else if (await exists(req.newPath)) {
    plan.problems.push(`"${newFileName}" already exists in that folder. Choose another name.`)
  } else if (
    (plan.assets.length > 0 || (req.options.notes && plan.counts.notes > 0)) &&
    (await exists(join(newDir, newBase)))
  ) {
    plan.problems.push(
      `A folder named "${newBase}" already exists there, and the copied files go into it. Choose another name.`
    )
  }
  return plan
}
