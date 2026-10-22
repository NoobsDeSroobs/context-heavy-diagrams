import { GROUP_SYSTEM, type FontOption } from '../styling/fontOptions'

// The fixed entries of every font dropdown: generic CSS families only, since a specific named font
// isn't reliably available on both target platforms (Windows/Linux). Named fonts come from the
// palette and from the computer (useFontOptions). '' is a real option meaning "no override" (see
// SelectField), stored as fontFamily: undefined. fontFamily is a raw CSS font-family string, not an
// enum. The four CSS generic families are categories, not fonts: each means "whichever font this
// computer uses for that kind", so they are grouped apart from named fonts.
export const FONT_FAMILY_OPTIONS: FontOption[] = [
  { value: '', label: 'Default' },
  { value: 'sans-serif', label: 'Sans-serif', group: GROUP_SYSTEM },
  { value: 'serif', label: 'Serif', group: GROUP_SYSTEM },
  { value: 'monospace', label: 'Monospace', group: GROUP_SYSTEM },
  { value: 'cursive', label: 'Cursive', group: GROUP_SYSTEM }
]
