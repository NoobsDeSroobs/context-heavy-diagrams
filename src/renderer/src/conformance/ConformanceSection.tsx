import type { CheckResult, Finding } from '@shared/conformance/check'
import type { ConformanceState } from './useConformance'

const SEVERITY_ORDER = ['error', 'warning', 'info']

function summary(result: CheckResult): string {
  const count = (severity: Finding['severity']): number =>
    result.findings.filter((f) => f.severity === severity).length
  const errors = count('error')
  const warnings = count('warning')
  const infos = count('info')
  return `${result.conforms ? 'Conforms' : 'Does not conform'} to ${result.profileName}: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${infos} info`
}

// The "Architecture check" block of the Diagnostics panel (ADR 0131): pick a profile, see where the
// open diagram breaks it, click a finding to find the element on the canvas.
export default function ConformanceSection({
  conformance,
  result,
  onRevealNode
}: {
  conformance: ConformanceState
  result: CheckResult | null
  onRevealNode: (nodeId: string) => void
}): React.JSX.Element {
  const { listing, selectedId, select, problems, refresh } = conformance
  const groups: { label: string; source: 'built-in' | 'folder' }[] = [
    { label: 'Built-in', source: 'built-in' },
    { label: 'Your profiles', source: 'folder' }
  ]
  const findings = result
    ? [...result.findings].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      )
    : []

  return (
    <div className="diagnostics-conformance">
      <p className="diagnostics-section-title">Architecture check</p>
      <div className="diagnostics-conformance-pick">
        <select
          value={selectedId}
          aria-label="Profile to check against"
          onChange={(event) => select(event.target.value)}
        >
          <option value="">Not checking</option>
          {groups.map(({ label, source }) => {
            const items = listing.filter((p) => p.source === source)
            return items.length === 0 ? null : (
              <optgroup key={source} label={label}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        <button
          type="button"
          title="Read the profile file again, after editing it"
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      {problems.length > 0 && (
        <>
          <p className="diagnostics-panel-hint">
            This profile cannot be used until these are fixed:
          </p>
          <ul className="diagnostics-panel-list">
            {problems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </>
      )}

      {result && (
        <>
          <p
            className={`diagnostics-conformance-summary${result.conforms ? '' : ' diagnostics-conformance-failing'}`}
          >
            {summary(result)}
          </p>
          <ul className="diagnostics-conformance-list">
            {findings.map((finding, index) => (
              <li key={index} className="diagnostics-conformance-finding">
                <span className={`diagnostics-conformance-severity severity-${finding.severity}`}>
                  {finding.severity}
                </span>
                <button
                  type="button"
                  className="diagnostics-missing-file-target"
                  disabled={finding.nodeIds.length === 0}
                  title={
                    finding.nodeIds.length > 0
                      ? 'Find this element on the canvas'
                      : 'Applies to the whole diagram'
                  }
                  onClick={() => onRevealNode(finding.nodeIds[0])}
                >
                  {finding.message}
                  {finding.detail ? ` [${finding.detail}]` : ''}
                </button>
              </li>
            ))}
          </ul>
          {result.notEvaluated.length > 0 && (
            <p className="diagnostics-panel-hint">
              Not evaluated, because the diagram lacks the edge set they need:{' '}
              {result.notEvaluated.join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
