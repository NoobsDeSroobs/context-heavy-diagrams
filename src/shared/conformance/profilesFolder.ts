// What main and the renderer say to each other about conformance profiles (ADR 0131).

export interface ProfilesFolderInfo {
  // Where profiles live: the Preferences setting, or the default in the user-data folder.
  folder: string
  isDefault: boolean
}

// A profile the Diagnostics panel can check against. `id` is what `profiles:load` takes, so the
// renderer never names a path: "builtin:<name>" or "folder:<file name>".
export interface ProfileListing {
  id: string
  name: string
  source: 'built-in' | 'folder'
}

export type NewProfileResult =
  { status: 'created'; path: string } | { status: 'exists'; path: string } | { status: 'cancelled' }

// The message to show the user for a finished "New profile".
export function describeNewProfile(result: NewProfileResult): string | null {
  switch (result.status) {
    case 'created':
      return `Created ${result.path}. Open it in a text editor and work through it from the top: the edge values are the first thing to choose. docs/conformance-profile-format.md describes every field.`
    case 'exists':
      return `${result.path} already exists, so nothing was created. Choose another name.`
    case 'cancelled':
      return null
  }
}
