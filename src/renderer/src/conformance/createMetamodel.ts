import { describeNewMetamodel } from '@shared/conformance/metamodelsFolder'
import { showAlert } from '../ui/alerts'

// "New diagram metamodel…" (ADR 0131), from the File menu and the Preferences panel: a save
// dialog in the metamodels folder, then the template copied under the name chosen.
export async function createMetamodel(): Promise<void> {
  try {
    const message = describeNewMetamodel(await window.api.createMetamodel())
    if (message) showAlert(message)
  } catch (err) {
    showAlert(`Could not create the metamodel: ${err instanceof Error ? err.message : String(err)}`)
  }
}
