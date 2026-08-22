import type { GravityPreset } from '@shared/diagram'

// This app's own starting catalog — used whenever a diagram doesn't define
// its own (DiagramFile.gravityPresets absent/empty). See GravityPreset's
// own comment in shared/diagram.ts for why the catalog itself is
// diagram-level, not a hardcoded constant baked into every line.
export const DEFAULT_GRAVITY_PRESETS: GravityPreset[] = [
  { id: 'sharp', label: 'Sharp', value: 0 },
  { id: 'acute', label: 'Acute', value: 0.2 },
  { id: 'smooth', label: 'Smooth', value: 0.5 },
  { id: 'curvy', label: 'Curvy', value: 1 }
]

// Same "empty means the built-in default set" resolution used for
// ConnectionHandles' effectiveConnectionPoints — a diagram only needs to
// spell its own catalog out once it actually diverges from this app's
// defaults.
export function effectiveGravityPresets(presets: GravityPreset[]): GravityPreset[] {
  return presets.length > 0 ? presets : DEFAULT_GRAVITY_PRESETS
}
