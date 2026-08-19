// Blends `color` toward transparent by `opacityPercent` (0-100, matching
// the schema's fillOpacity/strokeOpacity/fontOpacity fields) using CSS
// color-mix() rather than hand-parsing the color string into rgba(). This
// works for any valid CSS color — hex, named ("red"), rgb()/hsl(), not
// just the 6-digit hex the color-swatch <input type=color> happens to
// produce — since the adjacent free-text field lets someone type anything.
// Supported since Chromium 111 (this project ships Electron 43, well past
// that — same reasoning as the context-stroke/context-fill marker colors).
export function withOpacity(color: string, opacityPercent: number | undefined): string {
  if (opacityPercent == null || opacityPercent >= 100) return color
  const clamped = Math.max(0, Math.min(100, opacityPercent))
  return `color-mix(in srgb, ${color} ${clamped}%, transparent)`
}
