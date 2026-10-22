// Browser APIs the real canvas needs and jsdom does not have (ADR 0127). Loaded for every renderer test.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class DOMMatrixReadOnlyStub {
  m22 = 1
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)
    if (scale) this.m22 = Number(scale[1])
  }
}

Object.assign(globalThis, {
  ResizeObserver: ResizeObserverStub,
  DOMMatrixReadOnly: DOMMatrixReadOnlyStub
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })
})

Element.prototype.scrollIntoView = () => {}
Object.defineProperty(SVGElement.prototype, 'getBBox', {
  writable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 })
})
