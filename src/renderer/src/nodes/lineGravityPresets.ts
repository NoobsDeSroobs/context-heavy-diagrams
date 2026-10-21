import type { GravityPreset } from '@shared/diagram'

// This app's own starting catalog — used whenever a diagram doesn't define
// its own (DiagramFile.gravityPresets absent/empty). See GravityPreset's
// own comment in shared/nodes/schema.ts for why the catalog itself is
// diagram-level, not a hardcoded constant baked into every line.
export const DEFAULT_GRAVITY_PRESETS: GravityPreset[] = [
  { id: 'sharp', label: 'Sharp', value: 0 },
  { id: 'acute', label: 'Acute', value: 0.2 },
  { id: 'smooth', label: 'Smooth', value: 0.5 },
  { id: 'curvy', label: 'Curvy', value: 1 }
]

// Three-tier fallback (ADR 0052, ADR 0066): Diagram override -> User
// default -> Built-in default. Same "empty means fall through" resolution
// ConnectionHandles' effectiveConnectionPoints uses for connection points
// — a diagram only needs to spell its own catalog out once it actually
// diverges, and a user only needs a Settings default once they want
// something other than this app's own built-in four everywhere.
export function effectiveGravityPresets(
  diagramPresets: GravityPreset[],
  userDefault?: GravityPreset[]
): GravityPreset[] {
  if (diagramPresets.length > 0) return diagramPresets
  if (userDefault && userDefault.length > 0) return userDefault
  return DEFAULT_GRAVITY_PRESETS
}
