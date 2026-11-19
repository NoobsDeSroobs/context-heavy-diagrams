import { useEffect, useState } from 'react'

// The first-start question about the default icon pack (ADR 0192): shown as a strip in the window,
// so the window is not covered while it waits. Main asks once per run and remembers either answer.
export default function IconPackOffer(): React.JSX.Element | null {
  const [asked, setAsked] = useState(false)

  useEffect(() => window.api.onIconPackOffer(() => setAsked(true)), [])

  if (!asked) return null
  const answer = (accept: boolean): void => {
    setAsked(false)
    void window.api.answerIconPackOffer(accept)
  }
  return (
    <div className="icon-pack-offer" role="status">
      <span className="icon-pack-offer-text">
        <strong>Install the default icon pack?</strong>
        <span className="icon-pack-offer-detail">
          Tabler Icons (about 5,000 line icons, MIT licence). Diagrams that use them show nothing
          until it is installed. You can also do it later from View &gt; Icon packs.
        </span>
      </span>
      <button type="button" onClick={() => answer(true)}>
        Install
      </button>
      <button type="button" onClick={() => answer(false)}>
        Not now
      </button>
    </div>
  )
}
