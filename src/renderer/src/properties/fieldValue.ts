// Split out from fields.tsx: react-refresh/only-export-components flags a
// file that exports both components and plain values/functions. Whether a
// field's value is uniform across the current selection — `mixed: true`
// means at least two selected items disagree; `value` is then meaningless
// and callers should show a blank/placeholder instead — the mixed-value
// convention the styling panel relies on.
export interface FieldValue<T> {
  value: T | undefined
  mixed: boolean
}

export function computeFieldValue<T, I>(
  items: I[],
  getter: (item: I) => T | undefined
): FieldValue<T> {
  if (items.length === 0) return { value: undefined, mixed: false }
  const first = getter(items[0])
  const allSame = items.every((item) => getter(item) === first)
  return allSame ? { value: first, mixed: false } : { value: undefined, mixed: true }
}
