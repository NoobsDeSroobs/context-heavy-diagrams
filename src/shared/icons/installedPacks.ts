import type { PackMeta, SubsetMeta } from './pack'

// What the icon pack manager shows and is told (ADR 0188). Never saved in a diagram.

export interface SubsetSummary {
  // The folder name: what a diagram's reference uses.
  folder: string
  meta: SubsetMeta
  iconCount: number
}

export interface PackSummary {
  // The folder name inside `icon-packs`.
  folder: string
  meta: PackMeta
  subsets: SubsetSummary[]
  iconCount: number
  // Other folders give this pack's name too: the pack is the first by folder name, and this one is
  // not used by a diagram.
  duplicateOf: string | null
  // What in pack.json or a subset.json could not be used.
  problems: string[]
}

export interface PackList {
  // Where the packs are on this machine.
  folder: string
  packs: PackSummary[]
}

export type InstallPhase = 'reading' | 'copying' | 'finishing'

export interface InstallProgress {
  phase: InstallPhase
  done: number
  total: number
}

export type InstallResult =
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | {
      status: 'installed'
      // The folder name the pack has in `icon-packs`, and the name a diagram knows it by.
      folder: string
      name: string
      // True when a pack of that name was already there and was added to.
      updated: boolean
      added: number
      // Things left out, each a sentence for the person.
      skipped: string[]
    }

// 'trash' is the system's; 'kept' is a hidden folder in the packs folder, for a machine with none.
export type RemoveResult = { ok: true; where: 'trash' | 'kept' } | { ok: false; message: string }
