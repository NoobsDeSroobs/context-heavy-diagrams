import {
  recoveredNoteShadow,
  restoredNoteShadow,
  type NoteShadow,
  type RecoverySnapshot
} from '@shared/document/documentSave'

// Notes restored from a crash-recovery snapshot become dirty shadows. With their
// recorded baseline the disk check still works (an outside edit made before the
// crash is still caught on Save); snapshots from older builds have none.
export function shadowsFromSnapshot(snapshot: RecoverySnapshot): Record<string, NoteShadow> {
  const out: Record<string, NoteShadow> = {}
  for (const [id, content] of Object.entries(snapshot.noteDrafts)) {
    const baseline = snapshot.noteBaselines?.[id]
    if (baseline) {
      out[id] = restoredNoteShadow(id, content, baseline)
    } else {
      const notePath = snapshot.diagram.nodes.find((n) => n.id === id)?.data?.notes
      out[id] = recoveredNoteShadow(id, typeof notePath === 'string' ? notePath : null, content)
    }
  }
  return out
}

// A note nobody edited needs no in-memory copy: the next open reads the file fresh (ADR 0092). Drops
// every clean shadow except the one of the note that is open, and returns the same object when
// there is nothing to drop so a state update with it does not re-render.
export function pruneCleanShadows(
  shadows: Record<string, NoteShadow>,
  openNodeId: string | null
): Record<string, NoteShadow> {
  let next: Record<string, NoteShadow> | null = null
  for (const id in shadows) {
    if (id === openNodeId || shadows[id].dirty) continue
    next ??= { ...shadows }
    delete next[id]
  }
  return next ?? shadows
}
