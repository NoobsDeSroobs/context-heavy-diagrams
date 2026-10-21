import type { Theme } from './theme'
import { withOpacity } from './colorOpacity'
import { defaultStyleCssVars } from '@shared/styling/styleDefaults'

// Puts the built-in default look (styleDefaults.ts, ADR 0117) onto the document
// as CSS custom properties, where main.css picks it up. Called before the first
// paint and again on every theme change.
export function applyDefaultStyleVars(theme: Theme): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(defaultStyleCssVars(theme, withOpacity))) {
    root.style.setProperty(name, value)
  }
}
