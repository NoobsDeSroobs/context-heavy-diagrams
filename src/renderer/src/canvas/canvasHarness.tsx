import { render, type RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import type { DiagramFile } from '@shared/diagram'
import Canvas from './Canvas'

// Test helper (ADR 0127): the real Canvas in jsdom with a stand-in for the preload bridge. Every
// bridge method resolves to nothing and every `onX` subscription returns a no-op unsubscribe;
// pass `over` to replace what a test cares about.
type Api = Record<string, unknown>

function fakeApi(over: Api): Api {
  const cache: Api = {}
  return new Proxy(cache, {
    get(_t, name: string) {
      if (name in over) return over[name]
      if (!(name in cache)) {
        cache[name] = name.startsWith('on') ? vi.fn(() => () => {}) : vi.fn(async () => undefined)
      }
      return cache[name]
    }
  })
}

interface CanvasHarness extends RenderResult {
  api: Api
  // What the main process does when the user closes the window.
  requestClose: () => Promise<void>
}

export function renderCanvas(diagram?: DiagramFile, over: Api = {}): CanvasHarness {
  let closeRequested: (() => Promise<void> | void) | undefined
  const api = fakeApi({
    openDiagramAtPath: vi.fn(async () => ({ diagram, stamp: '1:1' })),
    checkRecoveryForPath: vi.fn(async () => null),
    onCloseRequested: vi.fn((cb: () => Promise<void> | void) => {
      closeRequested = cb
      return () => {}
    }),
    requestCloseDecision: vi.fn(async () => 'cancel'),
    closeApproved: vi.fn(),
    checkResourceFiles: vi.fn(async (_dir: string, paths: string[]) =>
      paths.map((relativePath) => ({ relativePath, resolvedPath: relativePath, found: true }))
    ),
    ...over
  })
  vi.stubGlobal('api', api)
  window.history.replaceState(null, '', diagram ? '/?path=/demo/test.chd' : '/')
  const utils = render(<Canvas />)
  return {
    ...utils,
    api,
    // What the main process does when the user closes the window.
    requestClose: async (): Promise<void> => {
      await closeRequested?.()
    }
  }
}
