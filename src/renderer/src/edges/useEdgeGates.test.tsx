import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react'
import { useEdgeGates } from './useEdgeGates'

// A node that asks for the gates of an edge from `a` to `b` along a fixed path, and shows what it got.
function Probe({ data }: NodeProps): React.JSX.Element {
  const { enabled, source, target, path } = data as {
    enabled: boolean
    source: string
    target: string
    path: string
  }
  const gates = useEdgeGates(enabled, source, target, path)
  return (
    <div data-testid="gates">
      {gates
        .map((g) => `${g.containerId}:${g.axis}:${Math.round(g.x)},${Math.round(g.y)}`)
        .join(' ')}
    </div>
  )
}

function shown(enabled: boolean, source: string, target: string, path: string): void {
  const nodes: Node[] = [
    { id: 'lane', type: 'default', position: { x: 0, y: 0 }, width: 400, height: 200, data: {} },
    {
      id: 'a',
      type: 'default',
      position: { x: 100, y: 60 },
      width: 80,
      height: 40,
      parentId: 'lane',
      data: {}
    },
    { id: 'b', type: 'default', position: { x: 100, y: 400 }, width: 80, height: 40, data: {} },
    {
      id: 'probe',
      type: 'probe',
      position: { x: 600, y: 0 },
      width: 10,
      height: 10,
      data: { enabled, source, target, path }
    }
  ]
  render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 800 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={{ probe: Probe }} />
      </div>
    </ReactFlowProvider>
  )
}

describe('the gates of an edge on the canvas', () => {
  afterEach(cleanup)

  it('lie along the border of the container the edge leaves', async () => {
    shown(true, 'a', 'b', 'M 140 100 L 140 400')
    await waitFor(() =>
      expect(screen.getByTestId('gates').textContent).toBe('lane:horizontal:140,200')
    )
  })

  it('are none while the switch is off', async () => {
    shown(false, 'a', 'b', 'M 140 100 L 140 400')
    await waitFor(() => expect(screen.getByTestId('gates')).toBeTruthy())
    expect(screen.getByTestId('gates').textContent).toBe('')
  })

  it('are none for an edge between a container and what is in it', async () => {
    shown(true, 'a', 'lane', 'M 140 100 L 140 0')
    await waitFor(() => expect(screen.getByTestId('gates')).toBeTruthy())
    expect(screen.getByTestId('gates').textContent).toBe('')
  })
})
