import { useEffect, useState } from 'react'
import type { MetamodelsFolderInfo } from '@shared/conformance/metamodelsFolder'
import { FieldRow } from '../ui/fields'
import { showAlert } from '../ui/alerts'
import { createMetamodel } from './createMetamodel'

// Preferences: where the user's diagram metamodels live (ADR 0131), and a way to start a new one.
// `chosen` is the stored setting; the folder shown is resolved by main, which also knows the default.
export default function MetamodelsFolderSection({
  chosen,
  onReset
}: {
  chosen: string | undefined
  onReset: () => void
}): React.JSX.Element {
  const [info, setInfo] = useState<MetamodelsFolderInfo | null>(null)

  useEffect(() => {
    let live = true
    void window.api.getMetamodelsFolder().then((next) => {
      if (live) setInfo(next)
    })
    return () => {
      live = false
    }
  }, [chosen])

  const choose = (): void => {
    window.api
      .chooseMetamodelsFolder()
      .catch((err) =>
        showAlert(`Could not set the folder: ${err instanceof Error ? err.message : String(err)}`)
      )
  }

  return (
    <>
      <FieldRow label="Metamodels folder">
        <span
          className="preferences-folder-path"
          title="Where your diagram metamodels live and where New metamodel starts"
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
        <button type="button" onClick={() => void createMetamodel()}>
          New metamodel…
        </button>
      </div>
    </>
  )
}
