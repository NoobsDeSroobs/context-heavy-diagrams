interface PresenterBarProps {
  name: string
  step: number
  steps: number
  // Whether the controls are shown: they appear when the mouse moves (see usePresenterActivity).
  awake: boolean
  onPrevious: () => void
  onNext: () => void
  onLeave: () => void
}

// The presenter's controls (ADR 0194): over the canvas, out of sight until the mouse moves. The keys do
// the same (arrows, space, Home, End, Escape), so the bar is for the mouse. The step count is always
// there, small and faint in the corner, so the person can see how far the story has come.
export default function PresenterBar({
  name,
  step,
  steps,
  awake,
  onPrevious,
  onNext,
  onLeave
}: PresenterBarProps): React.JSX.Element {
  return (
    <>
      <div className="presenter-count" role="status" aria-label={`Step ${step} of ${steps}`}>
        {step}/{steps}
      </div>
      <div
        className={awake ? 'presenter-bar nodrag nopan is-awake' : 'presenter-bar nodrag nopan'}
        role="toolbar"
        aria-label="Presenter"
      >
        <span className="presenter-bar-name" title={name}>
          {name}
        </span>
        <button type="button" onClick={onPrevious} disabled={step <= 0} aria-label="Previous step">
          ◀
        </button>
        <button type="button" onClick={onNext} disabled={step >= steps} aria-label="Next step">
          ▶
        </button>
        <button type="button" onClick={onLeave} title="Leave the presentation (Esc)">
          Leave
        </button>
      </div>
    </>
  )
}
