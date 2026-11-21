interface PresenterBarProps {
  name: string
  step: number
  steps: number
  onPrevious: () => void
  onNext: () => void
  onLeave: () => void
}

// The presenter's controls (ADR 0195): over the canvas, out of the way until the pointer is near.
// The keys do the same (arrows, space, Home, End, Escape), so the bar is for the mouse.
export default function PresenterBar({
  name,
  step,
  steps,
  onPrevious,
  onNext,
  onLeave
}: PresenterBarProps): React.JSX.Element {
  return (
    <div className="presenter-bar nodrag nopan" role="toolbar" aria-label="Presenter">
      <span className="presenter-bar-name" title={name}>
        {name}
      </span>
      <button type="button" onClick={onPrevious} disabled={step <= 0} aria-label="Previous step">
        ◀
      </button>
      <span className="presenter-bar-count" aria-live="polite">
        {step} / {steps}
      </span>
      <button type="button" onClick={onNext} disabled={step >= steps} aria-label="Next step">
        ▶
      </button>
      <button type="button" onClick={onLeave} title="Leave the presentation (Esc)">
        Leave
      </button>
    </div>
  )
}
