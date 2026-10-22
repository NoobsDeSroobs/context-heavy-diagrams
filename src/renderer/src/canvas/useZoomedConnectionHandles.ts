import { useEffect } from 'react'
import { useStore, useStoreApi } from '@xyflow/react'
import { connectionRadiusForZoom } from './screenGeometry'

// Keeps connection handles hittable when zoomed out (ADR 0129). Handles are sized in flow units, so
// they shrink with the zoom. The live zoom goes to the canvas as `--canvas-zoom`, which nodes.css
// divides the handle size by; it is written straight to the DOM so a zoom tick re-renders nothing.
// Returns the `connectionRadius` prop for the drop side, which changes in only a few steps.
export function useZoomedConnectionHandles(): number {
  const store = useStoreApi()

  useEffect(() => {
    let lastDom: HTMLElement | null = null
    let lastZoom = 0
    const apply = (): void => {
      const { domNode, transform } = store.getState()
      const zoom = transform[2]
      if (!domNode || (domNode === lastDom && zoom === lastZoom)) return
      lastDom = domNode
      lastZoom = zoom
      domNode.style.setProperty('--canvas-zoom', String(zoom))
    }
    apply()
    return store.subscribe(apply)
  }, [store])

  return useStore((state) => connectionRadiusForZoom(state.transform[2]))
}
