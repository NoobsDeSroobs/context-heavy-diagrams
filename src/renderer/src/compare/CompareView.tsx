import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Background, ConnectionMode, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { effectiveGravityPresets } from '../nodes/lineGravityPresets'
import {
  classifyDiagrams,
  type Classification,
  type CompareStatus,
  type ElementChange
} from '@shared/compare/classify'
import DiagramContext, { type DiagramContextValue } from '../canvas/DiagramContext'
import { DEFAULT_EDGE_OPTIONS, edgeTypes, nodeTypes } from '../canvas/flowTypes'
import { useDetailsPeek } from '../details/useDetailsPeek'
import { fromDiagramFile } from '../document/diagramConversion'
import EdgeMarkerDefs from '../edges/edgeMarkers'
import { effectiveStylePalette, usePreferences } from '../preferences/preferences'
import { useTheme } from '../styling/theme'
import './compare.css'

const noop = (): void => {}

const STATUS_LABEL: Record<CompareStatus, string> = {
  added: 'Added',
  removed: 'Removed',
  links: 'Links or Details changed',
  content: 'Modified'
}
const STATUS_ORDER: CompareStatus[] = ['added', 'removed', 'links', 'content']

// Everything the node and edge components read from the editing canvas, with every action a
// no-op: this window draws a diagram, it never changes one.
function useReadOnlyContext(diagramPath: string | null): DiagramContextValue {
  const { theme } = useTheme()
  const { preferences } = usePreferences()
  const palette = useMemo(
    () => effectiveStylePalette(preferences.stylePalettes, preferences.activeStylePaletteId),
    [preferences.stylePalettes, preferences.activeStylePaletteId]
  )
  return useMemo(
    () => ({
      diagramPath,
      openContextMenu: noop,
      openIconPicker: noop,
      openColorPicker: noop,
      openDetailsPanel: noop,
      openReferencesFor: noop,
      openReferenceWindow: noop,
      addReferencesToNode: noop,
      removeReferenceFromNode: noop,
      handleLinkClick: noop,
      beginContinuousEdit: noop,
      endContinuousEdit: noop,
      pushSnapshot: noop,
      attachContainedNodes: noop,
      detachFromParent: noop,
      groupResize: { start: noop, resize: noop, end: noop },
      matchHighlights: () => [],
      edgeStraightSegmentLength: preferences.edgeStraightSegmentLength,
      maxConnectionPointsPerSide: preferences.maxConnectionPointsPerSide,
      theme,
      entityHighlightNodeId: null,
      paletteColors: palette.colors,
      paletteFonts: palette.fonts,
      diagramFontFamily: preferences.defaultFontFamily,
      gravityPresets: effectiveGravityPresets([], preferences.gravityPresetsUserDefault),
      searchMatchIds: new Set<string>(),
      isolateActive: false,
      isolateOpacity: preferences.isolateOpacity,
      selectAllOfType: noop,
      pendingLabelEditId: null,
      clearPendingLabelEdit: noop
    }),
    [diagramPath, preferences, theme, palette]
  )
}

// What the canvas cannot show: catalog and setting changes, and edges that could not be drawn as
// the file has them.
function diagramLevelNotices(c: Classification): string[] {
  const notices = c.diagramLevel.map((change) => {
    if (change.setting) return `${change.name}: ${change.setting.before} → ${change.setting.after}`
    const parts = [
      change.added.length > 0 && `+${change.added.join(', ')}`,
      change.removed.length > 0 && `−${change.removed.join(', ')}`,
      change.changed.length > 0 && `~${change.changed.join(', ')}`
    ].filter(Boolean)
    return `${change.name}: ${parts.join(' ')}`
  })
  if (c.repairedEdges.size > 0) {
    notices.push(
      `${c.repairedEdges.size} edge(s) name a connection point their node does not have; drawn to the nearest one`
    )
  }
  if (c.danglingEdges.length > 0) {
    notices.push(
      `${c.danglingEdges.length} edge(s) lead to a node that does not exist and cannot be drawn`
    )
  }
  return notices
}

function statusClass(change: ElementChange | undefined): string {
  return change ? `cmp-${change.status}` : 'cmp-dim'
}

function decorateNode(node: Node, change: ElementChange | undefined): Node {
  return { ...node, className: `cmp ${statusClass(change)}` }
}

// The label is drawn outside the edge's own element (EdgeLabelRenderer), so it needs the class too.
function decorateEdge(edge: Edge, change: ElementChange | undefined): Edge {
  const cls = statusClass(change)
  return { ...edge, className: `cmp ${cls}`, data: { ...edge.data, compareClass: cls } }
}

function CompareCanvas({
  path,
  classification
}: {
  path: string
  classification: Classification
}): React.JSX.Element {
  const { theme } = useTheme()
  const { preferences } = usePreferences()
  const context = useReadOnlyContext(path)
  const { peek, bindings } = useDetailsPeek()

  const { nodes, edges } = useMemo(() => {
    const flow = fromDiagramFile(classification.view)
    return {
      nodes: flow.nodes.map((n) => decorateNode(n, classification.nodes.get(n.id))),
      edges: flow.edges.map((e) => decorateEdge(e, classification.edges.get(e.id)))
    }
  }, [classification])

  const counts = classification.counts
  const notices = diagramLevelNotices(classification)

  const peekNode = peek ? nodes.find((n) => n.id === peek.nodeId) : undefined
  const peekChange = peek ? classification.nodes.get(peek.nodeId) : undefined

  return (
    <DiagramContext.Provider value={context}>
      <div className="compare-window">
        <div className="compare-legend" role="group" aria-label="Legend">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="compare-legend-item">
              <span className={`compare-swatch cmp-${status}`} />
              {STATUS_LABEL[status]} ({counts[status]})
            </span>
          ))}
          <span className="compare-legend-item">
            <span className="compare-swatch cmp-dim" />
            Unchanged or only moved or restyled
          </span>
        </div>
        {notices.length > 0 && (
          <div className="compare-diagram-level" role="status">
            <strong>Diagram-level changes</strong>
            {notices.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
        )}
        <div
          className="compare-canvas"
          // The same dimming strength as the editor's Isolate mode (ADR 0063).
          style={{ '--cmp-dim-opacity': preferences.isolateOpacity } as React.CSSProperties}
        >
          <EdgeMarkerDefs />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            onNodeMouseEnter={bindings.onNodeMouseEnter}
            onNodeMouseLeave={bindings.onNodeMouseLeave}
            connectionMode={ConnectionMode.Loose}
            onlyRenderVisibleElements
            colorMode={theme}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        {peek &&
          peekNode &&
          createPortal(
            <div
              className="peek-card compare-peek"
              style={{ left: peek.rect.left, top: peek.rect.bottom + 8, width: 300 }}
            >
              <div className="peek-card-title">
                {String(peekNode.data?.label ?? '').split('\n')[0] || '(unlabeled)'}
              </div>
              <div className="compare-peek-body">
                {peekChange ? STATUS_LABEL[peekChange.status] : 'Unchanged or only moved'}
                {peekChange?.fields
                  .flatMap((f) => f.lines)
                  .map((line) => (
                    <div key={line}>{line}</div>
                  ))}
              </div>
            </div>,
            document.body
          )}
      </div>
    </DiagramContext.Provider>
  )
}

// The compare window (?compare=<later file>&base=<earlier file>). Spike: both versions are files.
export default function CompareView(): React.JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const path = params.get('compare') ?? ''
  const basePath = params.get('base') ?? ''
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; c: Classification }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.api.rereadDiagramForDiff(basePath),
      window.api.rereadDiagramForDiff(path)
    ]).then(([base, next]) => {
      if (cancelled) return
      if (!base || !next) {
        setState({ kind: 'error', message: 'Could not read both versions of the diagram.' })
        return
      }
      setState({ kind: 'ready', c: classifyDiagrams(base, next) })
    })
    return () => {
      cancelled = true
    }
  }, [path, basePath])

  if (state.kind === 'loading') return <p className="compare-message">Comparing…</p>
  if (state.kind === 'error') return <p className="compare-message">{state.message}</p>
  return (
    <ReactFlowProvider>
      <CompareCanvas path={path} classification={state.c} />
    </ReactFlowProvider>
  )
}
