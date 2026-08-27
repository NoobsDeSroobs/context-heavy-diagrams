# 0100: Rename "Configuration" → "Diagram settings" and "Settings" → "Preferences"

## Status
Done (2026-08-28) — done in the same session as [epic 0096](0096-consolidate-diagram-configuration-panel.md), on `epic/0096-consolidate-diagram-configuration-panel`, not on a separate branch (the user asked to just finish it rather than defer). Recorded in [ADR 0052](../../decisions/0052-settings-ownership-tiers.md)'s 2026-08-27 addendum ("Done" section). `typecheck` + `lint` clean (0 errors). Not live-tested (Electron-only renderer).

**What landed:** `AppSettings`→`AppPreferences`, `DEFAULT_SETTINGS`→`DEFAULT_PREFERENCES`, `useSettings`→`usePreferences` (returns `{ preferences, updatePreferences }`), `SettingsPanel`→`PreferencesPanel`, `DiagramConfigPanel`→`DiagramSettingsPanel`; files `shared/settings.ts`→`preferences.ts`, `main/appSettings.ts`→`appPreferences.ts`, `renderer/settings.ts`→`preferences.ts`; IPC `settings:*`→`preferences:*`; CSS `.settings-panel*`→`.preferences-panel*`, `.diagram-config-*`→`.diagram-settings-*`; glossary tier headings; UI menu labels + panel titles + every "your Settings default" string; comments across `src/` and the ADRs. **Not renamed:** the on-disk `settings.json` filename (invisible; migration risk), the pre-ADR-0053 `localStorage` key `'settings'` (read-once migration only), the ADR 0032/0052 file*names* (their titles updated in place).

## Original scope notes (kept for reference)

## Goal
The three ownership tiers ([ADR 0052](../../decisions/0052-settings-ownership-tiers.md), [glossary](../../architecture/glossary.md)) are **Properties** (per-element) / **Configuration** (per-diagram) / **Settings** (per-app). In the UI, "Diagram configuration" and "Settings" sit next to each other in the View menu with nothing signalling the tier difference to a user who hasn't read the glossary.

The user's call: rename so a scope prefix does the disambiguation — per-diagram becomes **"Diagram settings"**, per-app becomes **"Preferences"** (the conventional term for app-wide user choices — macOS, Firefox, VS Code). And — explicitly — the glossary, code identifiers, and UI must all stay consistent, so this is not a label tweak.

This reverses [ADR 0052](../../decisions/0052-settings-ownership-tiers.md)'s Alternatives entry ("Renaming Settings to 'Preferences' … rejected as pure churn"). The churn is now being accepted deliberately for the clarity gain, once, with everything moving together.

## Scope
A mechanical sweep, roughly [epic 0066](0066-decouple-docs-from-epic-numbering.md)-scale:

- **Code identifiers**: `AppSettings` → `AppPreferences`; `DEFAULT_SETTINGS` → `DEFAULT_PREFERENCES`; `normalizeAppSettings` / `readAppSettings` / `writeAppSettings` / `updateAppSettings` → `*Preferences`; `useSettings` → `usePreferences`; `SettingsPanel` → `PreferencesPanel`; `DiagramConfigPanel` → `DiagramSettingsPanel`; the `useSettings` hook's `settings` / `updateSettings` locals passim.
- **Files**: `src/shared/settings.ts` → `preferences.ts`; `src/main/appSettings.ts` → `appPreferences.ts`; `src/renderer/src/settings.ts` → `preferences.ts`; `SettingsPanel.tsx` → `PreferencesPanel.tsx`; `DiagramConfigPanel.tsx` → `DiagramSettingsPanel.tsx`. Update every import (`@shared/settings` → `@shared/preferences`, `./settings`, `./components/SettingsPanel`, …).
- **IPC channels**: `settings:read` / `settings:write` / `settings:changed` → `preferences:*` (preload + main + renderer).
- **On-disk**: `app.getPath('userData')/settings.json` — decide whether to rename to `preferences.json` with a one-time migration read, or leave the filename (invisible to users) and only rename in code. Leaning: leave the file, rename in code — a migration for a filename nobody sees is gratuitous risk.
- **UI labels / strings**: menu items, panel titles, and every user-facing "your Settings default" / "saves it to your own Settings" hint string (`DiagramConfigPanel`, `GravityPresetsSection`, …) → "Preferences".
- **Glossary**: tier "Configuration" → "Diagram Settings", tier "Settings" → "Preferences"; the opening sentence and the fallback-pattern section.
- **ADRs**: [ADR 0052](../../decisions/0052-settings-ownership-tiers.md) gets an addendum recording the reversal (label + code, not just label — the whole point is consistency). Grep every other ADR / `docs/file-format.md` / `docs/architecture/**` for "Configuration" / "Settings" used as the tier term and update. Careful: "configuration" and "settings" also appear as ordinary English — only the tier-term uses change.
- **Comments**: `src/**` comments referring to "the Settings tier" / "SettingsPanel" / "Configuration (per-diagram)".

## Open questions
- `settings.json` on-disk filename — rename+migrate, or code-only rename (see Scope).
- Does the per-diagram tier want "Diagram Settings" (two words, capital S) or "Diagram settings" in prose/glossary? Pick one and be consistent.
- Order of operations: probably shared → main → renderer → docs, typecheck between each, one branch one PR.

## Notes
Deliberately its own epic, not folded into [epic 0096](0096-consolidate-diagram-configuration-panel.md) — that epic's PR is about panel structure; burying a 40-file rename in it would make it unreviewable. Accepts that epic 0096's consolidated panel ships as "Diagram configuration" and gets relabelled once more when this lands.
