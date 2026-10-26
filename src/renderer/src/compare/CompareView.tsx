import { useEffect, useMemo, useState } from 'react'
import { Background, ConnectionMode, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { effectiveGravityPresets } from '../nodes/lineGravityPresets'
import {
  classifyDiagrams,
  describeCount,
  type Classification,
  type CompareStatus,
  type ElementChange
} from '@shared/compare/classify'
import { STATUS_LABEL, diagramLevelText } from '@shared/compare/format'
import type { CompareSession } from '@shared/compare/session'
import {
  applyIdMatches,
  detectIdChurn,
  matchReplaced,
  type ChurnSuspicion,
  type IdMatches
} from '@shared/compare/match'
import DiagramContext, { type DiagramContextValue } from '../canvas/DiagramContext'
import { DEFAULT_EDGE_OPTIONS, edgeTypes, nodeTypes } from '../canvas/flowTypes'
import { useDetailsPeek } from '../details/useDetailsPeek'
import { fromDiagramFile } from '../document/diagramConversion'
import EdgeMarkerDefs from '../edges/edgeMarkers'
import { effectiveStylePalette } from '@shared/preferences/preferences'
import { useReadOnlyPreferences } from '../preferences/useReadOnlyPreferences'
import { useTheme } from '../styling/theme'
import CompareList from './CompareList'
import HoverCard from './HoverCard'
import { describeHover, type MatchedIds } from './hoverContent'
import { useCompareReview } from './useCompareReview'
import './compare.css'

const noop = (): void => {}

const STATUS_ORDER: CompareStatus[] = ['added', 'removed', 'links', 'content']

// Everything the node and edge components read from the editing canvas, with every action a
// no-op: this window draws a diagram, it never changes one.
function useReadOnlyContext(diagramPath: string | null): DiagramContextValue {
  const { theme } = useTheme()
  const { preferences } = useReadOnlyPreferences()
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
  const notices = c.diagramLevel.map(diagramLevelText)
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

// What the matching banner needs: whether to suggest it, what it found, and the two actions.
interface ChurnProps {
  suspicion: ChurnSuspicion
  matches: IdMatches | null
  matching: boolean
  onMatch: () => void
  onUndo: () => void
}

function CompareCanvas({
  sessionId,
  session,
  classification,
  churn
}: {
  sessionId: string
  session: CompareSession
  classification: Classification
  churn: ChurnProps
}): React.JSX.Element {
  const { theme } = useTheme()
  const { preferences } = useReadOnlyPreferences()
  const context = useReadOnlyContext(session.diagramPath)
  const { peek, bindings } = useDetailsPeek()
  const [showRestyled, setShowRestyled] = useState(true)
  const [edgePointer, setEdgePointer] = useState({ x: 0, y: 0 })
  const [showList, setShowList] = useState(true)

  // Converting the diagram is the costly part, so it happens once; marking is cheap and follows
  // the toggle and the selected change.
  const flow = useMemo(() => fromDiagramFile(classification.view), [classification])
  const items = classification.review
  const { currentKey, reviewed, revertStates, focusItem, step, toggleReviewed, revertItem } =
    useCompareReview(sessionId, items, flow, churn.matches)
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

  const matchedIds = useMemo<MatchedIds>(
    () => ({
      nodes: new Set(churn.matches?.nodes.values() ?? []),
      edges: new Set(churn.matches?.edges.values() ?? [])
    }),
    [churn.matches]
  )

  const notices = diagramLevelNotices(classification)
  const card = peek ? describeHover(classification, peek.nodeId, nodes, edges, matchedIds) : null

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
        {!churn.matches && churn.suspicion.suspected && (
          <div className="compare-churn" role="status">
            <strong>Many elements look replaced, not edited.</strong>
            <span>
              {churn.suspicion.twins} of {churn.suspicion.removed} removed elements have an added
              element with the same name and type, so the ids probably changed.
            </span>
            <button type="button" onClick={churn.onMatch} disabled={churn.matching}>
              {churn.matching ? 'Matching…' : 'Match them up'}
            </button>
          </div>
        )}
        {churn.matches && (
          <div className="compare-churn compare-churn-done" role="status">
            <span>
              Matched {churn.matches.nodes.size} elements and {churn.matches.edges.size} connections
              by name and place. This is a guess: check the ones marked as matched.
              {churn.matches.fuzzySkipped
                ? ' The diagram is large, so the similarity pass was cut short and only closer matches were paired.'
                : ''}
            </span>
            <button type="button" onClick={churn.onUndo}>
              Undo matching
            </button>
          </div>
        )}
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
              canRevert={session.diagramPath !== null}
              revertStates={revertStates}
              onSelect={focusItem}
              onToggleReviewed={toggleReviewed}
              onRevert={(item) => void revertItem(item)}
              onPrevious={() => step(-1)}
              onNext={() => step(1)}
            />
          )}
        </div>
        {peek && card && <HoverCard card={card} rect={peek.rect} pointer={edgePointer} />}
      </div>
    </DiagramContext.Provider>
  )
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: CompareSession; suspicion: ChurnSuspicion }

// The compare window (?compare=<session id>). The two versions are held by the main process.
export default function CompareView(): React.JSX.Element {
  const id = new URLSearchParams(window.location.search).get('compare') ?? ''
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // The pairs found when the reviewer asked for the elements of a rewrite to be matched, or none.
  const [matches, setMatches] = useState<IdMatches | null>(null)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.getCompareSession(id).then((session) => {
      if (cancelled) return
      if (!session) {
        setState({ kind: 'error', message: 'This comparison is no longer available.' })
        return
      }
      document.title = session.title
      setState({ kind: 'ready', session, suspicion: detectIdChurn(session.base, session.next) })
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const session = state.kind === 'ready' ? state.session : null
  const classification = useMemo(
    () =>
      session
        ? classifyDiagrams(
            matches ? applyIdMatches(session.base, matches) : session.base,
            session.next,
            {
              detailsContent: new Map(Object.entries(session.detailsContent ?? {}))
            }
          )
        : null,
    [session, matches]
  )

  // Matching is the quadratic part, so it runs when asked, after the button has shown "Matching…".
  const match = (): void => {
    if (!session) return
    setMatching(true)
    setTimeout(() => {
      setMatches(matchReplaced(session.base, session.next))
      setMatching(false)
    }, 30)
  }

  if (state.kind === 'loading') return <p className="compare-message">Comparing…</p>
  if (state.kind === 'error' || !session || !classification) {
    return (
      <p className="compare-message">
        {state.kind === 'error' ? state.message : 'This comparison is no longer available.'}
      </p>
    )
  }
  return (
    <ReactFlowProvider>
      <CompareCanvas
        // A different pairing is a different comparison: the ticks and reverts start afresh.
        key={matches ? 'matched' : 'plain'}
        sessionId={id}
        session={session}
        classification={classification}
        churn={{
          suspicion: state.suspicion,
          matches,
          matching,
          onMatch: match,
          onUndo: () => setMatches(null)
        }}
      />
    </ReactFlowProvider>
  )
}
