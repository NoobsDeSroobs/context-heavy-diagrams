import { useCallback, useEffect, useState } from 'react'
import type { InstallProgress, InstallResult, PackList } from '@shared/icons/installedPacks'
import { TABLER_PACK } from '@shared/icons/iconRefs'
import { useTheme } from '../styling/theme'
import './packManager.css'

const PHASE_TEXT = {
  reading: 'Reading the folder…',
  copying: 'Copying the icons…',
  finishing: 'Putting the pack in place…'
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function outcomeText(result: InstallResult): { text: string; notes: string[]; failed: boolean } {
  if (result.status === 'installed') {
    const what = plural(result.added, 'icon', 'icons')
    return {
      text: result.updated
        ? `Updated "${result.name}" with ${what}.`
        : `Installed "${result.name}" with ${what}.`,
      notes: result.skipped,
      failed: false
    }
  }
  if (result.status === 'failed') return { text: result.message, notes: [], failed: true }
  return { text: '', notes: [], failed: false }
}

// The icon pack manager (ADR 0188): its own window, where packs are installed, updated and removed.
// A pack is a folder; installing copies it into the per-user icon-packs folder. Installing a pack
// with the name of an installed one adds to that pack and keeps its metadata.
export default function IconPackManager(): React.JSX.Element {
  // Follows the app's light or dark choice, as every window does.
  useTheme()
  const [list, setList] = useState<PackList | null>(null)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [outcome, setOutcome] = useState<ReturnType<typeof outcomeText> | null>(null)
  const busy = progress !== null

  const refresh = useCallback(() => {
    void window.api.listIconPacks().then(setList)
  }, [])

  useEffect(() => {
    refresh()
    // A pack copied into the folder by hand shows up when the person comes back to this window.
    window.addEventListener('focus', refresh)
    const stop = window.api.onIconPacksChanged(refresh)
    const stopProgress = window.api.onIconPackProgress(setProgress)
    // An install the app started itself (the first-start question) ends here too.
    const stopEnded = window.api.onIconPackInstallEnded((result) => {
      setProgress(null)
      setOutcome(outcomeText(result))
      refresh()
    })
    return () => {
      window.removeEventListener('focus', refresh)
      stop()
      stopProgress()
      stopEnded()
    }
  }, [refresh])

  const run = (start: () => Promise<InstallResult>): void => {
    setOutcome(null)
    setProgress({ phase: 'reading', done: 0, total: 0 })
    void start().then((result) => {
      setProgress(null)
      setOutcome(outcomeText(result))
      refresh()
    })
  }
  const install = (): void => run(() => window.api.installIconPack())
  const installTabler = (): void => run(() => window.api.installTablerPack())
  const hasTabler = list?.packs.some((p) => p.meta.name === TABLER_PACK && p.duplicateOf === null)

  const remove = (folder: string): void => {
    setOutcome(null)
    void window.api.removeIconPack(folder).then((result) => {
      if (result.ok) {
        setOutcome({
          text:
            result.where === 'trash'
              ? 'Moved to the trash.'
              : 'Moved to the hidden .removed folder in the icon packs folder.',
          notes: [],
          failed: false
        })
      } else if (result.message !== '') {
        setOutcome({ text: result.message, notes: [], failed: true })
      }
      refresh()
    })
  }

  return (
    <div className="packs-window">
      <header className="packs-header">
        <h1>Icon packs</h1>
        <div className="packs-actions">
          <button type="button" onClick={install} disabled={busy}>
            Install a pack…
          </button>
          {list && !hasTabler && (
            <button type="button" onClick={installTabler} disabled={busy}>
              Install Tabler icons
            </button>
          )}
          <button type="button" onClick={() => void window.api.showIconPacksFolder()}>
            Show the folder
          </button>
        </div>
      </header>
      <p className="packs-hint">
        A pack is a folder of subfolders of SVG files. Installing one whose name is already
        installed adds to it and updates its icons.
      </p>

      {progress && (
        <div className="packs-progress" role="status">
          <span>
            {PHASE_TEXT[progress.phase]}
            {progress.phase === 'copying' && ` ${progress.done} of ${progress.total}`}
          </span>
          <progress
            value={progress.total > 0 ? progress.done : undefined}
            max={progress.total > 0 ? progress.total : undefined}
          />
          <button type="button" onClick={() => void window.api.cancelIconPackInstall()}>
            Cancel
          </button>
        </div>
      )}

      {outcome && outcome.text !== '' && (
        <div
          className={`packs-outcome${outcome.failed ? ' packs-failed' : ''}`}
          role={outcome.failed ? 'alert' : 'status'}
        >
          <p>{outcome.text}</p>
          {outcome.notes.length > 0 && (
            <ul>
              {outcome.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {list && list.packs.length === 0 && (
        <p className="packs-empty">No icon packs are installed.</p>
      )}
      <ul className="packs-list">
        {list?.packs.map((pack) => (
          <li key={pack.folder} className="pack">
            <div className="pack-head">
              <span className="pack-name">{pack.meta.name}</span>
              {pack.meta.version !== '' && (
                <span className="pack-version">{pack.meta.version}</span>
              )}
              <button
                type="button"
                className="pack-remove"
                onClick={() => remove(pack.folder)}
                disabled={busy}
              >
                Remove
              </button>
            </div>
            {pack.meta.description !== '' && <p>{pack.meta.description}</p>}
            <p className="pack-counts">
              {plural(pack.iconCount, 'icon', 'icons')} in{' '}
              {plural(pack.subsets.length, 'subset', 'subsets')}
              {pack.folder !== pack.meta.name && ` · folder "${pack.folder}"`}
            </p>
            {pack.duplicateOf !== null && (
              <p className="pack-warning">
                The pack in the folder &quot;{pack.duplicateOf}&quot; has the same name, so diagrams
                use that one and not this.
              </p>
            )}
            {pack.problems.length > 0 && (
              <ul className="pack-warning">
                {pack.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {list && <p className="packs-folder">{list.folder}</p>}
    </div>
  )
}
