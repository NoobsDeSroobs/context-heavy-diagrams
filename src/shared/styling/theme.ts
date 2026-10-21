// The two colour themes. Defined here, not in the renderer, because the style defaults and the SVG
// export (ADR 0124) are shared with code that never loads the renderer.
export type Theme = 'light' | 'dark'
