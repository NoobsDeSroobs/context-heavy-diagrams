import type { IconRef } from '@shared/diagram'
import { showAlert } from '../ui/alerts'

// Asks for an icon file and adds it to the Misc icons pack (ADR 0188); null when the person cancels
// or it cannot be added, which is said in an alert. The icon needs no saved diagram: it lives in a
// pack, not in the diagram's folder.
export async function addMiscIcon(): Promise<IconRef | null> {
  const result = await window.api.addMiscIcon()
  if (result.status === 'added')
    return { source: 'installed', pack: result.pack, path: result.path }
  if (result.status === 'failed') showAlert(`The icon could not be added: ${result.message}`)
  return null
}
