import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Edge, Node } from '@xyflow/react'
import type {
  DiagramSecurity,
  EdgeDirectionSet,
  GravityPreset,
  HighlightDefinition,
  JsonValue,
  LegendEntry,
  RequiredTagDefinition
} from '@shared/diagram'
import { buildExportLegendItems } from '@shared/legend/legendItems'
import { effectiveDiagramFont } from '@shared/styling/fontStack'
import { directionSetLegendRow } from '../edges/edgeDirectionSets'
import { toDiagramFile } from '../document/diagramConversion'
import { showAlert } from '../ui/alerts'
import type { CanvasApi } from '../canvas/canvasApi'
import type { AppPreferences } from '../preferences/preferences'
import type { Theme } from '../styling/theme'
import type { ImageExportChoice } from './ExportImageDialog'
import { buildDiagramSvg } from './exportSvg'
import { captureDiagramPng, resolveEffectiveBackgroundColor, rgbStringToHex } from './exportPng'

export interface ImageExportInputs {
  nodes: Node[]
  edges: Edge[]
  diagramMetadata: Record<string, JsonValue>
  requiredTags: RequiredTagDefinition[]
  highlights: HighlightDefinition[]
  legend: LegendEntry[]
  gravityPresets: GravityPreset[]
  diagramMaxConnectionPointsPerSide: number | undefined
  diagramFontFamily: string | undefined
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  security: DiagramSecurity
  enabledHighlightIds: Set<string>
  theme: Theme
  preferences: Pick<AppPreferences, 'edgeStraightSegmentLength' | 'defaultFontFamily'>
  flowWrapperRef: React.RefObject<HTMLDivElement | null>
  updateNodeInternals: (nodeIds: string[]) => void
}

export interface ImageExportState {
  exportDialogFormat: 'png' | 'svg' | null
  setExportDialogFormat: React.Dispatch<React.SetStateAction<'png' | 'svg' | null>>
  exportPngEffectiveColorHex: string
  isExportingPng: boolean
  handleExportPng: (choice: ImageExportChoice) => Promise<void>
  handleExportSvg: (choice: ImageExportChoice) => Promise<void>
}

// Exporting the diagram as a PNG (ADR 0051) or an SVG (ADR 0124).
export function useImageExport(
  { setNodes, setEdges, currentPath }: CanvasApi,
  {
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    diagramFontFamily,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    enabledHighlightIds,
    theme,
    preferences,
    flowWrapperRef,
    updateNodeInternals
  }: ImageExportInputs
): ImageExportState {
  // Which image export the dialog is open for, if any (PNG, ADR 0051; SVG, ADR 0124).
  const [exportDialogFormat, setExportDialogFormat] = useState<'png' | 'svg' | null>(null)
  const [exportPngEffectiveColorHex, setExportPngEffectiveColorHex] = useState('#ffffff')
  // onlyRenderVisibleElements (ADR 0073) keeps React Flow from mounting
  // off-screen nodes/edges — a large win on big diagrams, but PNG export
  // (handleExportPng) clones the .react-flow__viewport DOM subtree, so
  // every off-screen element would be missing from the capture. Flipped
  // true for the duration of a capture so the whole diagram is in the DOM.
  const [isExportingPng, setIsExportingPng] = useState(false)

  // PNG export (ADR 0051). Selection outlines and resize/connection-point handles render inside
  // each node based on node.selected, so everything is deselected first (flushSync, so the DOM
  // updates before html-to-image reads it; a plain setNodes/setEdges would commit only after this
  // function returns). That keeps them out of the image without knowing how each node type draws
  // its selected state. Restored afterwards, including on failure. `choice` comes from
  // ExportImageDialog, which is where these values are edited; preferences.pngExport* only remembers
  // the last choice so the dialog reopens prefilled.
  const handleExportPng = useCallback(
    async (choice: ImageExportChoice) => {
      const viewportEl = flowWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
      if (!viewportEl) return
      const previouslySelectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
      const previouslySelectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id)
      try {
        flushSync(() => {
          // Mount every node/edge (onlyRenderVisibleElements, ADR 0073) so
          // the .react-flow__viewport clone below isn't missing off-screen
          // content.
          setIsExportingPng(true)
          setNodes((current) => current.map((n) => (n.selected ? { ...n, selected: false } : n)))
          setEdges((current) => current.map((e) => (e.selected ? { ...e, selected: false } : e)))
        })
        // Just-mounted off-screen nodes need their handle bounds measured
        // before their edges will render (EdgeWrapper returns null for an
        // edge whose endpoints aren't initialized — see loadDiagramIntoCanvas)
        // — same synchronous-measure fix, then wait a frame for the commit.
        updateNodeInternals(nodes.map((n) => n.id))
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
        const legendItems = buildExportLegendItems(
          legend,
          highlights,
          enabledHighlightIds,
          directionSetLegendRow(edgeDirectionSets, activeEdgeDirectionSetId)
        )
        const dataUrl = await captureDiagramPng(
          nodes,
          edges.map((e) => ({ source: e.source, target: e.target })),
          viewportEl,
          {
            paddingPx: choice.paddingPx,
            transparentBackground: choice.transparentBackground,
            backgroundColorOverride: choice.backgroundColorOverride,
            legend:
              legendItems.length > 0
                ? { items: legendItems, corner: choice.legendCorner, diagramPath: currentPath }
                : undefined
          }
        )
        const suggestedFilename = currentPath
          ? currentPath
              .split(/[\\/]/)
              .pop()!
              .replace(/\.chd$/, '.png')
          : 'diagram.png'
        await window.api.exportPngToFile(dataUrl, suggestedFilename)
      } catch (error) {
        showAlert(`PNG export failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setIsExportingPng(false)
        setNodes((current) =>
          current.map((n) =>
            previouslySelectedNodeIds.includes(n.id) ? { ...n, selected: true } : n
          )
        )
        setEdges((current) =>
          current.map((e) =>
            previouslySelectedEdgeIds.includes(e.id) ? { ...e, selected: true } : e
          )
        )
      }
    },
    [
      flowWrapperRef,
      nodes,
      edges,
      setNodes,
      setEdges,
      currentPath,
      legend,
      highlights,
      enabledHighlightIds,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      updateNodeInternals
    ]
  )

  // SVG export (ADR 0124): rendered from the diagram's data, not from the DOM, so unlike the PNG
  // export it needs no deselecting, no mounting of off-screen elements and no waiting for a frame.
  // A node that has no stored size is given the size React Flow measured for it.
  const handleExportSvg = useCallback(
    async (choice: ImageExportChoice) => {
      try {
        const sized = nodes.map((n) =>
          n.width == null && n.measured?.width != null && n.measured.height != null
            ? { ...n, width: n.measured.width, height: n.measured.height }
            : n
        )
        const diagram = toDiagramFile(
          sized,
          edges,
          diagramMetadata,
          requiredTags,
          highlights,
          legend,
          gravityPresets,
          diagramMaxConnectionPointsPerSide,
          edgeDirectionSets,
          activeEdgeDirectionSetId,
          security,
          diagramFontFamily
        )
        const fileName = currentPath ? currentPath.split(/[\\/]/).pop()! : 'diagram.chd'
        const svg = await buildDiagramSvg(diagram, {
          theme,
          paddingPx: choice.paddingPx,
          transparentBackground: choice.transparentBackground,
          backgroundColorHex: choice.backgroundColorOverride ?? exportPngEffectiveColorHex,
          legendCorner: choice.legendCorner,
          enabledHighlightIds: [...enabledHighlightIds],
          edgeStraightSegmentLength: preferences.edgeStraightSegmentLength,
          diagramPath: currentPath,
          fontFamily: effectiveDiagramFont(diagramFontFamily, preferences.defaultFontFamily),
          title: fileName.replace(/\.chd$/, '')
        })
        await window.api.exportSvgToFile(svg, fileName.replace(/\.chd$/, '') + '.svg')
      } catch (error) {
        showAlert(`SVG export failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      diagramFontFamily,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      currentPath,
      theme,
      exportPngEffectiveColorHex,
      enabledHighlightIds,
      preferences.edgeStraightSegmentLength,
      preferences.defaultFontFamily
    ]
  )

  // Refs can't be read during render (React lint rule, and genuinely
  // unsafe under concurrent rendering) — so ExportImageDialog's color-swatch
  // preview is computed here, once, right as the dialog opens, rather than
  // inline in JSX on every render.
  useEffect(() => {
    if (!exportDialogFormat) return
    const viewportEl = flowWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    setExportPngEffectiveColorHex(
      viewportEl ? rgbStringToHex(resolveEffectiveBackgroundColor(viewportEl)) : '#ffffff'
    )
  }, [exportDialogFormat, flowWrapperRef])

  return {
    exportDialogFormat,
    setExportDialogFormat,
    exportPngEffectiveColorHex,
    isExportingPng,
    handleExportPng,
    handleExportSvg
  }
}
