import type { FinalConnectionState } from '@xyflow/react'

// Shared by onConnectEnd (a new edge dragged from a handle) and onReconnectEnd (an existing edge's
// end dragged loose): tells "released on genuine empty canvas" from every other way a drag can end.
// `!connectionState.isValid` is the primary signal. The pane class on `event.target` alone (React
// Flow's documented pattern) is not enough: RF snaps to any handle within `connectionRadius` (20px
// by default), so a drop a few pixels off a handle still completes a connection while the element
// under the cursor is the pane. The pane check stays as well, so a merely invalid drop (over a node
// body without a handle, or over toolbar/panel UI) doesn't spawn an anchor either.
export function isVoidDrop(
  event: MouseEvent | TouchEvent,
  connectionState: FinalConnectionState
): boolean {
  if (connectionState.isValid) return false
  const target = event.target
  return target instanceof Element && target.classList.contains('react-flow__pane')
}

// React Flow's `connectionRadius` is in flow units, so the 20px default shrinks to a few screen
// pixels when zoomed out. Doubling it per halving of the zoom keeps the screen radius between about
// 14 and 28 px, and moves in few enough steps that the prop rarely changes while zooming. Zoomed in,
// the default stays.
export const DEFAULT_CONNECTION_RADIUS = 20

export function connectionRadiusForZoom(zoom: number): number {
  if (!(zoom > 0) || zoom >= 1) return DEFAULT_CONNECTION_RADIUS
  return DEFAULT_CONNECTION_RADIUS * 2 ** Math.round(Math.log2(1 / zoom))
}

// MouseEvent and TouchEvent expose the release coordinates differently.
export function pointFromEvent(event: MouseEvent | TouchEvent): {
  clientX: number
  clientY: number
} {
  return 'changedTouches' in event ? event.changedTouches[0] : event
}

// Centre of the part of the window that is the canvas, in screen coordinates. The right-hand dock
// takes its share of the window, so the window centre sits right of what the user is looking at.
//
// willSelect: a paste selects what it adds, which swaps the narrow palette dock for the wider
// properties panel and shrinks the canvas from the right, so a paste centred on the canvas as it is
// now ends up right of centre. Pass true to centre on the canvas as it will be once that panel is
// open.
//
// Falls back to the window centre if the canvas isn't mounted yet.
export function visibleCanvasCenter(willSelect = false): { x: number; y: number } {
  const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
  if (!pane || pane.width <= 0 || pane.height <= 0) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
  let right = pane.right
  if (willSelect) {
    const dock = document.querySelector('.diagram-dock')?.getBoundingClientRect()
    const panelWidth = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dock-properties-width')
    )
    if (dock && Number.isFinite(panelWidth)) right = dock.right - panelWidth
  }
  return { x: pane.left + (right - pane.left) / 2, y: pane.top + pane.height / 2 }
}
