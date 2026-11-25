import { useEffect } from 'react'
import { useStore, useStoreApi, useUpdateNodeInternals } from '@xyflow/react'
import { connectionRadiusForZoom, handleSizeForZoom } from './screenGeometry'

// How long the zoom has to rest before the handles are measured again.
const REMEASURE_DELAY_MS = 50

// Keeps connection handles hittable when zoomed out (ADR 0129). Handles are sized in flow units, so
// they shrink with the zoom. The live zoom goes to the canvas as `--canvas-zoom`, which nodes.css
// divides the handle size by; it is written straight to the DOM so a zoom tick re-renders nothing.
// Returns the `connectionRadius` prop for the drop side, which changes in only a few steps.
//
// An edge ends on the outer rim of its handle, and React Flow measures a handle once, when the node is
// measured. A handle that has since grown or shrunk with the zoom leaves the edge ending where the
// old rim was, further from the element the more the zoom has moved. So when the zoom comes to rest
// and the handle size has changed, every node is measured again.
export function useZoomedConnectionHandles(): number {
  const store = useStoreApi()
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    let lastDom: HTMLElement | null = null
    let lastZoom = 0
    // The handle size the nodes were last measured at; the CSS falls back to a zoom of 1.
    let measuredSize = handleSizeForZoom(1)
    // Set when the zoom has been at a handle size other than the measured one since, even if it came
    // back: nodes that mounted on the way were measured at the other size.
    let stale = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const remeasure = (): void => {
      if (!stale) return
      stale = false
      measuredSize = handleSizeForZoom(store.getState().transform[2])
      updateNodeInternals([...store.getState().nodeLookup.keys()])
    }
    const apply = (): void => {
      const { domNode, transform } = store.getState()
      const zoom = transform[2]
      if (!domNode || (domNode === lastDom && zoom === lastZoom)) return
      lastDom = domNode
      lastZoom = zoom
      domNode.style.setProperty('--canvas-zoom', String(zoom))
      if (Math.abs(handleSizeForZoom(zoom) - measuredSize) >= 0.5) stale = true
      clearTimeout(timer)
      timer = setTimeout(remeasure, REMEASURE_DELAY_MS)
    }
    apply()
    const unsubscribe = store.subscribe(apply)
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [store, updateNodeInternals])

  return useStore((state) => connectionRadiusForZoom(state.transform[2]))
}
