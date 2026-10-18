import { isNewerThanApp, newerFileMessage } from '@shared/appVersion'
import { showAlert } from './alerts'
import { PROJECT_URL } from './projectInfo'

// Warns when a diagram was saved by a NEWER app than the one opening it, because
// saving it here could drop what this version does not understand (ADR 0118).
// Never for the same version, an older one, or a file with no marker.
//
// Once per file per window: reloading the file you already saw the warning for
// does not ask again, but opening a different newer file in the same window does.
let lastWarnedFor: string | null = null

export async function warnIfSavedWithNewer(
  path: string | null,
  savedWith: string | undefined
): Promise<void> {
  if (!savedWith) return
  const appVersion = await window.api.getAppVersion()
  if (!isNewerThanApp(savedWith, appVersion)) return
  const key = `${path ?? ''}|${savedWith}`
  if (lastWarnedFor === key) return
  lastWarnedFor = key
  // The dialog's Copy button copies the address, which is the one thing worth carrying away.
  showAlert(newerFileMessage(savedWith, appVersion, PROJECT_URL), PROJECT_URL)
}
