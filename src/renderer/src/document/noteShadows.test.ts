import { describe, expect, it } from 'vitest'
import {
  editNote,
  loadedNoteShadow,
  recoveredNoteShadow,
  restoredNoteShadow
} from '@shared/document/documentSave'
import type { NoteBaseline, RecoverySnapshot } from '@shared/document/documentSave'
import type { DiagramFile } from '@shared/diagram'
import { pruneCleanShadows, shadowsFromSnapshot } from './noteShadows'

const diagram: DiagramFile = {
  version: 1,
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A', notes: 'notes/a.md' } },
    { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } }
  ],
  edges: []
}

describe('shadowsFromSnapshot', () => {
  it('restores a note that has a recorded baseline from that baseline', () => {
    const baseline: NoteBaseline = {
      originalPath: 'notes/a.md',
      stamp: '1:2',
      baselineContent: 'saved text'
    }
    const snapshot: RecoverySnapshot = {
      diagram,
      noteDrafts: { a: 'draft' },
      noteBaselines: { a: baseline }
    }
    expect(shadowsFromSnapshot(snapshot).a).toEqual(restoredNoteShadow('a', 'draft', baseline))
  })

  it('treats a note from an older snapshot as recovered, taking its path from the node', () => {
    const snapshot: RecoverySnapshot = { diagram, noteDrafts: { a: 'x', b: 'y' } }
    const out = shadowsFromSnapshot(snapshot)
    expect(out.a).toEqual(recoveredNoteShadow('a', 'notes/a.md', 'x'))
    expect(out.b).toEqual(recoveredNoteShadow('b', null, 'y'))
  })
})

describe('pruneCleanShadows', () => {
  const clean = loadedNoteShadow('a', 'notes/a.md', '1:1', 'text')
  const dirty = editNote(loadedNoteShadow('b', 'notes/b.md', '1:1', 'text'), 'edited')
  const open = loadedNoteShadow('c', 'notes/c.md', '1:1', 'text')

  it('drops the clean shadows and keeps the edited one and the open one', () => {
    const out = pruneCleanShadows({ a: clean, b: dirty, c: open }, 'c')
    expect(Object.keys(out).sort()).toEqual(['b', 'c'])
  })

  it('returns the same object when there is nothing to drop', () => {
    const shadows = { b: dirty, c: open }
    expect(pruneCleanShadows(shadows, 'c')).toBe(shadows)
  })

  it('drops a clean shadow when no note is open', () => {
    expect(pruneCleanShadows({ a: clean }, null)).toEqual({})
  })
})
