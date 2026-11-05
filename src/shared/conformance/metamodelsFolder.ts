// What main and the renderer say to each other about diagram metamodels (ADR 0131).

export interface MetamodelsFolderInfo {
  // Where metamodels live: the Preferences setting, or the default in the user-data folder.
  folder: string
  isDefault: boolean
}

// A metamodel the Diagnostics panel can check against. `id` is what `metamodels:load` takes, so the
// renderer never names a path: "builtin:<name>" or "folder:<file name>".
export interface MetamodelListing {
  id: string
  name: string
  source: 'built-in' | 'folder'
}

export type NewMetamodelResult =
  { status: 'created'; path: string } | { status: 'exists'; path: string } | { status: 'cancelled' }

// The message to show the user for a finished "New metamodel".
export function describeNewMetamodel(result: NewMetamodelResult): string | null {
  switch (result.status) {
    case 'created':
      return `Created ${result.path}. Open it in a text editor and work through it from the top: the edge values are the first thing to choose. docs/metamodel-format.md describes every field.`
    case 'exists':
      return `${result.path} already exists, so nothing was created. Choose another name.`
    case 'cancelled':
      return null
  }
}
