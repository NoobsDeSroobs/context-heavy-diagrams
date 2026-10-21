import type { AppPreferences } from './preferences/preferences'

// What the Windows installer's options page can seed (ADR 0108): the
// installer drops `install-options.json` next to the executable and the app
// turns it into the first-run preferences. Only whitelisted, correctly typed
// fields survive, so a hand-edited, truncated or foreign file can never put
// anything into the preferences except a legitimate choice — and an
// unreadable one just means "no install options", i.e. defaults.
export function parseInstallOptions(raw: string): Partial<AppPreferences> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}
  const options: Partial<AppPreferences> = {}
  const { aiFeaturesEnabled } = parsed as { aiFeaturesEnabled?: unknown }
  if (typeof aiFeaturesEnabled === 'boolean') options.aiFeaturesEnabled = aiFeaturesEnabled
  return options
}
