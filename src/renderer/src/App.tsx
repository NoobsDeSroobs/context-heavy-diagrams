import Canvas from './canvas/Canvas'
import CompareView from './compare/CompareView'
import IconPackManager from './icons/IconPackManager'

// A window is the editor unless main opened it for a comparison (?compare=) or for the icon pack
// manager (?iconPacks).
const QUERY = new URLSearchParams(window.location.search)

function App(): React.JSX.Element {
  if (QUERY.has('compare')) return <CompareView />
  if (QUERY.has('iconPacks')) return <IconPackManager />
  return <Canvas />
}

export default App
