// Small grey lock glyph shown on a locked node — centered horizontally,
// straddling the top edge of the node's own bounding box, per the user's
// own placement spec. Shared by EntityNode/ContainerNode/TextNode rather
// than duplicated three times; a plain inline SVG (not a builtin icon
// slot — those are user content, this is a system indicator, and doesn't
// need asset loading either way).
export default function LockBadge(): React.JSX.Element {
  return (
    <div className="node-lock-badge" title="Locked — drag/resize/rotate/delete disabled">
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </div>
  )
}
