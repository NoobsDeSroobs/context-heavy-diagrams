import { useMemo, useState } from 'react'
import type { EdgeStyle } from '@shared/diagram'
import { searchLineStylePresets } from '../styles/builtinLineStylePresets'

interface StylePickerProps {
  anchorRect: DOMRect
  onPick: (style: Partial<EdgeStyle>) => void
  onClose: () => void
}

const PICKER_WIDTH = 220

// Searchable named-preset picker for an edge's line style/markers — see
// ADR 0010. Reuses IconPicker's exact fixed-positioned popup shell
// (.icon-picker/.icon-picker-search/.icon-picker-scroll classes) so this
// and the icon picker feel like the same interaction pattern, not two to
// learn. Picking an entry just pre-fills the raw style fields (lineStyle/
// startMarker/endMarker) via the same updateEdgeStyle the property panel
// uses — nothing "remembers" which preset was picked.
export default function StylePicker({ anchorRect, onPick, onClose }: StylePickerProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchLineStylePresets(query), [query])

  const left = Math.min(anchorRect.right + 8, window.innerWidth - PICKER_WIDTH - 8)
  const top = Math.min(anchorRect.top, window.innerHeight - 280)

  return (
    <div className="icon-picker nodrag nopan" style={{ left, top, width: PICKER_WIDTH }}>
      <input
        className="icon-picker-search"
        placeholder="Search line styles…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className="icon-picker-scroll">
        <div className="style-picker-list">
          {results.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="style-picker-item"
              onClick={() => onPick(preset.style)}
            >
              <span className={`style-picker-swatch style-picker-swatch-${preset.style.lineStyle ?? 'solid'}`} />
              {preset.label}
            </button>
          ))}
          {results.length === 0 && <div className="icon-picker-label">No matches</div>}
        </div>
      </div>
      <div className="icon-picker-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
