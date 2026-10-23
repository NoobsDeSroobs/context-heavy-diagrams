import { useEffect, useState } from 'react'
import type { ProfilesFolderInfo } from '@shared/conformance/profilesFolder'
import { FieldRow } from '../ui/fields'
import { showAlert } from '../ui/alerts'
import { createProfile } from './createProfile'

// Preferences: where the user's conformance profiles live (ADR 0131), and a way to start a new one.
// `chosen` is the stored setting; the folder shown is resolved by main, which also knows the default.
export default function ProfilesFolderSection({
  chosen,
  onReset
}: {
  chosen: string | undefined
  onReset: () => void
}): React.JSX.Element {
  const [info, setInfo] = useState<ProfilesFolderInfo | null>(null)

  useEffect(() => {
    let live = true
    void window.api.getProfilesFolder().then((next) => {
      if (live) setInfo(next)
    })
    return () => {
      live = false
    }
  }, [chosen])

  const choose = (): void => {
    window.api
      .chooseProfilesFolder()
      .catch((err) =>
        showAlert(`Could not set the folder: ${err instanceof Error ? err.message : String(err)}`)
      )
  }

  return (
    <>
      <FieldRow label="Profiles folder">
        <span
          className="preferences-folder-path"
          title="Where your conformance profiles live and where New profile starts"
        >
          {info ? info.folder : '…'}
        </span>
      </FieldRow>
      <div className="preferences-folder-actions">
        <button type="button" onClick={choose}>
          Choose folder…
        </button>
        <button type="button" disabled={info?.isDefault ?? true} onClick={onReset}>
          Use default
        </button>
        <button type="button" onClick={() => void createProfile()}>
          New profile…
        </button>
      </div>
    </>
  )
}
