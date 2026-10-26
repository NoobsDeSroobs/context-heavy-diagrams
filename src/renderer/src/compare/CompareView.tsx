import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { effectiveGravityPresets } from '../nodes/lineGravityPresets'
import {
  classifyDiagrams,
  describeCount,
  reviewKey,
  type Classification,
  type CompareStatus,
  type ElementChange,
  type ReviewItem
} from '@shared/compare/classify'
import type { CompareSession } from '@shared/compare/session'
import DiagramContext, { type DiagramContextValue } from '../canvas/DiagramContext'
import { DEFAULT_EDGE_OPTIONS, edgeTypes, nodeTypes } from '../canvas/flowTypes'
import { useDetailsPeek } from '../details/useDetailsPeek'
import { fromDiagramFile } from '../document/diagramConversion'
import EdgeMarkerDefs from '../edges/edgeMarkers'
import { effectiveStylePalette, usePreferences } from '../preferences/preferences'
import { useTheme } from '../styling/theme'
import CompareList from './CompareList'
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

// The element the list has selected gets a halo, so it can be found among the dimmed ones.
const CURRENT = ' cmp-current'

function decorateNode(
  node: Node,
  change: ElementChange | undefined,
  restyled: boolean,
  current: boolean
): Node {
  const marks = `${restyled ? ' cmp-restyled' : ''}${current ? CURRENT : ''}`
  return { ...node, className: `cmp ${statusClass(change)}${marks}` }
}

// The label is drawn outside the edge's own element (EdgeLabelRenderer), so it needs the class too.
function decorateEdge(edge: Edge, change: ElementChange | undefined, current: boolean): Edge {
  const cls = `${statusClass(change)}${current ? CURRENT : ''}`
  return { ...edge, className: `cmp ${cls}`, data: { ...edge.data, compareClass: cls } }
}

interface HoverCard {
  edge: boolean
  title: string
  status: string
  lines: string[]
}

function hoverCard(c: Classification, id: string, nodes: Node[], edges: Edge[]): HoverCard | null {
  const node = nodes.find((n) => n.id === id)
  const edge = node ? undefined : edges.find((e) => e.id === id)
  if (!node && !edge) return null
  const change = node ? c.nodes.get(id) : c.edges.get(id)
  const lines = (change?.fields ?? []).flatMap((f) => f.lines)
  if (node ? c.restyledNodes.has(id) : c.restyledEdges.has(id))
    lines.push('restyled (look changed)')
  if (edge && c.repairedEdges.has(id)) {
    lines.push('names a connection point its node lacks; drawn to the nearest one')
  }
  const nodeTitle = String(node?.data?.label ?? '').split('\n')[0]
  const title = node
    ? nodeTitle || '(unlabeled)'
    : String(edge?.data?.label ?? '') ||
      `${labelOf(nodes, edge?.source)} → ${labelOf(nodes, edge?.target)}`
  return {
    edge: edge !== undefined,
    title,
    status: change ? STATUS_LABEL[change.status] : 'Unchanged or only moved',
    lines
  }
}

const CARD_WIDTH = 320
const CARD_HEIGHT_GUESS = 180

// Under a node, or beside the pointer for an edge, and always inside the window.
function cardPosition(
  edge: boolean,
  rect: { left: number; bottom: number },
  pointer: { x: number; y: number }
): React.CSSProperties {
  const left = edge ? pointer.x + 12 : rect.left
  const top = edge ? pointer.y + 16 : rect.bottom + 8
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - CARD_HEIGHT_GUESS)),
    width: CARD_WIDTH
  }
}

function labelOf(nodes: Node[], id: string | undefined): string {
  const label = String(nodes.find((n) => n.id === id)?.data?.label ?? '').split('\n')[0]
  return label || id || '?'
}

function CompareCanvas({
  session,
  classification
}: {
  session: CompareSession
  classification: Classification
}): React.JSX.Element {
  const { theme } = useTheme()
  const { preferences } = usePreferences()
  const context = useReadOnlyContext(session.diagramPath)
  const { peek, bindings } = useDetailsPeek()
  const [showRestyled, setShowRestyled] = useState(true)
  // Where the pointer entered an edge: a long edge's own box is no place to anchor its card.
  const [edgePointer, setEdgePointer] = useState({ x: 0, y: 0 })

  const rf = useReactFlow()
  const [showList, setShowList] = useState(true)
  // The change the list has selected ("node:<id>" / "edge:<id>"), and the ones the reviewer has
  // ticked off. Both last only as long as this window.
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(new Set())

  // Converting the diagram is the costly part, so it happens once; marking is cheap and follows
  // the toggle and the selected change.
  const flow = useMemo(() => fromDiagramFile(classification.view), [classification])
  const { nodes, edges } = useMemo(
    () => ({
      nodes: flow.nodes.map((n) =>
        decorateNode(
          n,
          classification.nodes.get(n.id),
          showRestyled && classification.restyledNodes.has(n.id),
          currentKey === `node:${n.id}`
        )
      ),
      edges: flow.edges.map((e) =>
        decorateEdge(e, classification.edges.get(e.id), currentKey === `edge:${e.id}`)
      )
    }),
    [flow, classification, showRestyled, currentKey]
  )

  const items = classification.review
  const focusItem = useCallback(
    (item: ReviewItem) => {
      setCurrentKey(reviewKey(item))
      // A connection is framed by the two elements it joins.
      const ids =
        item.kind === 'node'
          ? [item.id]
          : flow.edges.filter((e) => e.id === item.id).flatMap((e) => [e.source, e.target])
      const targets = flow.nodes.filter((n) => ids.includes(n.id)).map((n) => ({ id: n.id }))
      if (targets.length > 0) {
        void rf.fitView({ nodes: targets, duration: 300, padding: 0.6, maxZoom: 1.5 })
      }
    },
    [flow, rf]
  )
  const step = useCallback(
    (direction: 1 | -1) => {
      if (items.length === 0) return
      const index = items.findIndex((i) => reviewKey(i) === currentKey)
      const next =
        index === -1
          ? direction === 1
            ? 0
            : items.length - 1
          : (index + direction + items.length) % items.length
      focusItem(items[next])
    },
    [items, currentKey, focusItem]
  )
  const toggleReviewed = useCallback((item: ReviewItem) => {
    const key = reviewKey(item)
    setReviewed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // N / P or the arrow keys walk the list; Space ticks the selected change off. Typing in a field
  // and shortcuts with a modifier are left alone.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'n' || event.key === 'ArrowDown') {
        event.preventDefault()
        step(1)
      } else if (event.key === 'p' || event.key === 'ArrowUp') {
        event.preventDefault()
        step(-1)
      } else if (event.key === ' ' && target === document.body && currentKey !== null) {
        event.preventDefault()
        const item = items.find((i) => reviewKey(i) === currentKey)
        if (item) toggleReviewed(item)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, items, currentKey, toggleReviewed])

  const notices = diagramLevelNotices(classification)
  const card = peek ? hoverCard(classification, peek.nodeId, nodes, edges) : null

  return (
    <DiagramContext.Provider value={context}>
      <div className="compare-window">
        <div className="compare-legend" role="group" aria-label="Legend">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="compare-legend-item">
              <span className={`compare-swatch cmp-${status}`} />
              {STATUS_LABEL[status]} ({describeCount(classification.counts[status])})
            </span>
          ))}
          <span className="compare-legend-item">
            <span className="compare-swatch cmp-dim" />
            Unchanged or only moved or restyled
          </span>
          <label className="compare-legend-item compare-legend-toggle">
            <input
              type="checkbox"
              checked={showList}
              onChange={(event) => setShowList(event.target.checked)}
            />
            Changes list
          </label>
          <label className="compare-legend-item">
            <input
              type="checkbox"
              checked={showRestyled}
              onChange={(event) => setShowRestyled(event.target.checked)}
            />
            <span className="compare-brush" aria-hidden="true" />
            Mark restyled ({classification.restyledNodes.size})
          </label>
        </div>
        {notices.length > 0 && (
          <div className="compare-diagram-level" role="status">
            <strong>Diagram-level changes</strong>
            {notices.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
        )}
        <div className="compare-body">
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
              onEdgeMouseEnter={(event, edge) => {
                setEdgePointer({ x: event.clientX, y: event.clientY })
                bindings.onNodeMouseEnter(event, edge)
              }}
              onEdgeMouseLeave={bindings.onNodeMouseLeave}
              connectionMode={ConnectionMode.Loose}
              // The editor's zoom limits (Preferences), so a big diagram fits the window.
              minZoom={preferences.minZoom}
              maxZoom={preferences.maxZoom}
              onlyRenderVisibleElements
              colorMode={theme}
              fitView
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          {showList && (
            <CompareList
              items={items}
              currentKey={currentKey}
              reviewed={reviewed}
              onSelect={focusItem}
              onToggleReviewed={toggleReviewed}
              onPrevious={() => step(-1)}
              onNext={() => step(1)}
            />
          )}
        </div>
        {peek &&
          card &&
          createPortal(
            <div
              className="peek-card compare-peek"
              style={cardPosition(card.edge, peek.rect, edgePointer)}
            >
              <div className="peek-card-title">{card.title}</div>
              <div className="compare-peek-body">
                <div>{card.status}</div>
                {card.lines.map((line) => (
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

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: CompareSession; classification: Classification }

// The compare window (?compare=<session id>). The two versions are held by the main process.
export default function CompareView(): React.JSX.Element {
  const id = new URLSearchParams(window.location.search).get('compare') ?? ''
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    window.api.getCompareSession(id).then((session) => {
      if (cancelled) return
      if (!session) {
        setState({ kind: 'error', message: 'This comparison is no longer available.' })
        return
      }
      document.title = session.title
      setState({
        kind: 'ready',
        session,
        classification: classifyDiagrams(session.base, session.next, {
          detailsContent: new Map(Object.entries(session.detailsContent ?? {}))
        })
      })
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (state.kind === 'loading') return <p className="compare-message">Comparing…</p>
  if (state.kind === 'error') return <p className="compare-message">{state.message}</p>
  return (
    <ReactFlowProvider>
      <CompareCanvas session={state.session} classification={state.classification} />
    </ReactFlowProvider>
  )
}
