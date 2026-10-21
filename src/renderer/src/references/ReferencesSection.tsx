import type { Node } from '@xyflow/react'
import ReferenceImage from './ReferenceImage'
import { useDiagramContext } from '../useDiagramContext'
import { CollapsibleSection } from '../panels/fields'

// Reference-image management for a single selected entity/container (see
// ADR 0069). Viewing happens in the floating windows; this is where
// you add and remove. All the actual work lives on Canvas via context.
export default function ReferencesSection({ node }: { node: Node }): React.JSX.Element {
  const { diagramPath, addReferencesToNode, removeReferenceFromNode, openReferenceWindow } =
    useDiagramContext()
  const refs = Array.isArray(node.data?.references) ? (node.data.references as string[]) : []

  return (
    <CollapsibleSection title={`References (${refs.length})`} sectionKey="references">
      <p className="property-references-hint">
        Screenshots or diagrams kept as reference while working. Shown only in floating windows —
        never on the canvas or in exports.
      </p>
      {refs.length > 0 && (
        <div className="property-references-grid">
          {refs.map((path) => (
            <div key={path} className="property-references-item">
              <button
                type="button"
                className="property-references-thumb"
                title={`Open ${path.split('/').pop()}`}
                onClick={() => openReferenceWindow(node.id, path)}
              >
                <ReferenceImage diagramPath={diagramPath} path={path} />
              </button>
              <button
                type="button"
                className="property-references-remove"
                title="Remove from this entity"
                aria-label="Remove reference"
                onClick={() => removeReferenceFromNode(node.id, path)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="property-references-add"
        onClick={() => addReferencesToNode(node.id)}
      >
        Add images…
      </button>
    </CollapsibleSection>
  )
}
