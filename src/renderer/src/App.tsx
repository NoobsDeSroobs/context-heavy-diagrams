import Canvas from './canvas/Canvas'
import CompareView from './compare/CompareView'

// A window is the editor unless main opened it for a comparison (?compare=).
const IS_COMPARE = new URLSearchParams(window.location.search).has('compare')

function App(): React.JSX.Element {
  return IS_COMPARE ? <CompareView /> : <Canvas />
}

export default App
