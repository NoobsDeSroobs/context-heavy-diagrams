import { createHash } from 'node:crypto'

// The stale-edit fingerprint (ADR 0109): SHA-256 of the raw bytes, lowercase
// hex. The same definition as `chd hash` in the command-line tool.
export function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/
