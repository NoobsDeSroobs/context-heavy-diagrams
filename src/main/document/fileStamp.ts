import { stat } from 'fs/promises'

// Cheap "has this file changed since I last looked" fingerprint — modified
// time + size, compared only against a stamp we recorded ourselves (never
// against the wall clock, so clock skew is irrelevant). null = the file
// doesn't exist / can't be stat'd. See docs/decisions/0091-external-change-detection.md.
export async function fileStamp(path: string): Promise<string | null> {
  try {
    const s = await stat(path)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return null
  }
}
