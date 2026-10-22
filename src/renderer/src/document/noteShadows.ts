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
  for (const [id, content] of Object.entries(snapshot.detailsDrafts)) {
    const baseline = snapshot.noteBaselines?.[id]
    if (baseline) {
      out[id] = restoredNoteShadow(id, content, baseline)
    } else {
      const details = snapshot.diagram.nodes.find((n) => n.id === id)?.data?.details
      out[id] = recoveredNoteShadow(id, typeof details === 'string' ? details : null, content)
    }
  }
  return out
}
