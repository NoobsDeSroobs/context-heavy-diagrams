import type { BetaFeature } from '@shared/features/features'
import { FieldRow } from '../ui/fields'
import { BETA_FEATURES_ANCHOR } from './betaFeaturesAnchor'

// The beta features, each off until switched on here. Omitted when there are none, so a release
// without a beta shows nothing.
export default function BetaFeaturesSection({
  registry,
  flags,
  onChange
}: {
  registry: readonly BetaFeature[]
  flags: Readonly<Record<string, boolean>>
  onChange: (flags: Record<string, boolean>) => void
}): React.JSX.Element | null {
  if (registry.length === 0) return null
  return (
    <div id={BETA_FEATURES_ANCHOR} className="preferences-beta-features">
      <div className="preferences-beta-features-title">Beta features</div>
      <p className="preferences-panel-hint">
        Features still being tried. Each is off until you switch it on, may change or be removed,
        and never changes what is already in a diagram.
      </p>
      {registry.map((feature) => (
        <div key={feature.id} className="preferences-beta-feature">
          <FieldRow label={`${feature.label} (beta)`}>
            <input
              type="checkbox"
              checked={flags[feature.id] === true}
              onChange={(e) => onChange({ ...flags, [feature.id]: e.target.checked })}
              title={feature.description}
            />
          </FieldRow>
          <p className="preferences-panel-hint">
            {feature.description} Reviewed by {feature.reviewBy}.
            {feature.report ? ` ${feature.report}` : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
