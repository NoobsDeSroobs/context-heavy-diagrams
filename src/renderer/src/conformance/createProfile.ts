import { describeNewProfile } from '@shared/conformance/profilesFolder'
import { showAlert } from '../ui/alerts'

// "New conformance profile…" (ADR 0131), from the File menu and the Preferences panel: a save
// dialog in the profiles folder, then the template copied under the name chosen.
export async function createProfile(): Promise<void> {
  try {
    const message = describeNewProfile(await window.api.createProfile())
    if (message) showAlert(message)
  } catch (err) {
    showAlert(`Could not create the profile: ${err instanceof Error ? err.message : String(err)}`)
  }
}
