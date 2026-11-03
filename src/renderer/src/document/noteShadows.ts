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
