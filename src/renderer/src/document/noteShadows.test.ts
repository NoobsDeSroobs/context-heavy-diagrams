import { describe, expect, it } from 'vitest'
import { recoveredNoteShadow, restoredNoteShadow } from '@shared/document/documentSave'
import type { NoteBaseline, RecoverySnapshot } from '@shared/document/documentSave'
import type { DiagramFile } from '@shared/diagram'
import { shadowsFromSnapshot } from './noteShadows'

const diagram: DiagramFile = {
  version: 1,
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A', details: 'details/a.md' } },
    { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } }
  ],
  edges: []
}

describe('shadowsFromSnapshot', () => {
  it('restores a note that has a recorded baseline from that baseline', () => {
    const baseline: NoteBaseline = {
      originalPath: 'details/a.md',
      stamp: '1:2',
      baselineContent: 'saved text'
    }
    const snapshot: RecoverySnapshot = {
      diagram,
      detailsDrafts: { a: 'draft' },
      noteBaselines: { a: baseline }
    }
    expect(shadowsFromSnapshot(snapshot).a).toEqual(restoredNoteShadow('a', 'draft', baseline))
  })

  it('treats a note from an older snapshot as recovered, taking its path from the node', () => {
    const snapshot: RecoverySnapshot = { diagram, detailsDrafts: { a: 'x', b: 'y' } }
    const out = shadowsFromSnapshot(snapshot)
    expect(out.a).toEqual(recoveredNoteShadow('a', 'details/a.md', 'x'))
    expect(out.b).toEqual(recoveredNoteShadow('b', null, 'y'))
  })
})
