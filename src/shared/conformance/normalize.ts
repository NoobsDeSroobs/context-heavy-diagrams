// How a profile compares text (ADR 0131): lower-cased with all whitespace removed, then equal.
// `Data Store` equals `datastore`; `port` does not equal `support`. Used for tag keys and values,
// role names, rule ids and the name of the edge direction set.
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}
