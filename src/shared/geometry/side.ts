// The four sides of a box. The values are the same strings as React Flow's `Position` enum, so the
// canvas can pass a `Position` straight in where a `Side` is expected, while the geometry code
// (shared with the SVG export, ADR 0124) stays free of the library.
export type Side = 'top' | 'right' | 'bottom' | 'left'
