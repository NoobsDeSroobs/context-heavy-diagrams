import { useCallback, useState } from 'react'
import type { Edge } from '@xyflow/react'
import type { EdgeStyle } from '@shared/diagram'
import { EDGE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import { useEventCallback } from '../canvas/useEventCallback'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import type { Theme } from '../styling/theme'
import { legendLineFromEdgeStyle, type LegendLineLook } from './legendLinePick'

export interface LegendLinePickState {
  legendLinePick: ((look: LegendLineLook | null) => void) | null
  requestLegendLinePick: (onPicked: (look: LegendLineLook | null) => void) => void
  cancelLegendLinePick: () => void
  abortLegendLinePick: () => void
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void
}

// Legend "Line" picker (ADR 0123): while the Legend panel waits for an edge to copy, it leaves
// its callback here. A click on an edge hands it that edge's look; Esc hands it null. Takes the
// click before the style brush, so an active brush never paints the edge being picked.
export function useLegendLinePick(
  theme: Theme,
  onStyleBrushEdgeClick: (event: React.MouseEvent, edge: Edge) => void
): LegendLinePickState {
  const [legendLinePick, setLegendLinePick] = useState<
    ((look: LegendLineLook | null) => void) | null
  >(null)
  const requestLegendLinePick = useCallback(
    (onPicked: (look: LegendLineLook | null) => void) => setLegendLinePick(() => onPicked),
    []
  )
  const cancelLegendLinePick = useCallback(() => setLegendLinePick(null), [])
  // Esc or the toolbar button: ends the mode and tells the panel, which drops its pending entry.
  const abortLegendLinePick = useEventCallback(() => {
    legendLinePick?.(null)
    setLegendLinePick(null)
  })
  const onEdgeClick = useEventCallback((event: React.MouseEvent, edge: Edge) => {
    if (!legendLinePick) {
      onStyleBrushEdgeClick(event, edge)
      return
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) return
    setLegendLinePick(null)
    legendLinePick(
      legendLineFromEdgeStyle(
        edge.data?.style as EdgeStyle | undefined,
        theme,
        themeAdaptiveColor,
        EDGE_STYLE_DEFAULTS
      )
    )
  })

  return {
    legendLinePick,
    requestLegendLinePick,
    cancelLegendLinePick,
    abortLegendLinePick,
    onEdgeClick
  }
}
