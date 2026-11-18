import { useInstalledIcon } from './installedIcons'

// An installed icon at the size of its box, with nothing around it: the picker's cells and the
// search box's icon. Empty until it is read, and when the pack or the icon is not there.
export default function InstalledIconPreview({
  pack,
  path
}: {
  pack: string
  path: string
}): React.JSX.Element | null {
  const icon = useInstalledIcon(pack, path)
  return icon.state === 'ready' ? (
    <span className="installed-icon-preview" dangerouslySetInnerHTML={{ __html: icon.markup }} />
  ) : null
}
