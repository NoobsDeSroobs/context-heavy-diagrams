import { useEffect, useState } from 'react'

// The font families installed on this computer, for the font dropdowns (ADR 0130). Asked for once
// per window, on first use, and kept: the call returns every face (hundreds on a typical machine)
// and the list does not change while the app runs.
interface LocalFontData {
  family: string
}

let families: Promise<string[]> | null = null

export function loadInstalledFontFamilies(): Promise<string[]> {
  families ??= (async () => {
    const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> })
      .queryLocalFonts
    // Missing, or refused by the permission handler: no installed group, nothing else breaks.
    if (!query) return []
    try {
      const faces = await query.call(window)
      return [...new Set(faces.map((face) => face.family))].sort((a, b) => a.localeCompare(b))
    } catch {
      return []
    }
  })()
  return families
}

export function useInstalledFontFamilies(): string[] {
  const [installed, setInstalled] = useState<string[]>([])
  useEffect(() => {
    let live = true
    void loadInstalledFontFamilies().then((list) => {
      if (live) setInstalled(list)
    })
    return () => {
      live = false
    }
  }, [])
  return installed
}
