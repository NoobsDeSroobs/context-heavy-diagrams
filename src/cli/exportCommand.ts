import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { parseDiagram, type DiagramFile } from '../shared/diagram.ts'
import { containedPath } from '../main/containedPath.ts'
import { highlightId } from '../shared/highlights.ts'
import type { LegendCorner } from '../shared/preferences.ts'
import {
  collectIconRefs,
  DEFAULT_SVG_EXPORT_OPTIONS,
  defaultLegendItems,
  iconKey,
  renderDiagramSvg,
  type IconAsset,
  type SvgExportOptions
} from '../shared/svg/renderDiagram.ts'

// `chd export` (ADR 0124): a .chd file to an SVG image without opening the app, so a README or a
// wiki image can be regenerated whenever the diagram changes. Bundled into resources/cli/export.mjs
// by scripts/build-cli.mjs; chd.mjs loads it only for this command. Read-only on the diagram, so the
// stale-edit rule (ADR 0109) does not apply; the output must be an .svg, so it can never overwrite a
// diagram.

export const EXPORT_USAGE = `Usage: chd export <file.chd> [options]

  -o, --output <file.svg>   Where to write (default: next to the diagram, same name). '-' is stdout.
  --theme light|dark        Which look to draw (default: light)
  --padding <px>            Margin around the drawing (default: ${DEFAULT_SVG_EXPORT_OPTIONS.paddingPx})
  --background <value>      'theme' (default), 'transparent' or a colour such as #ffffff
  --no-legend               Leave the legend out
  --legend-corner <corner>  bottom-left (default), bottom-right, top-left or top-right
  --highlight <key[=value]> Draw a highlight as if it were switched on (repeatable); 'key' alone
                            switches on every value of that key
`

const CORNERS: LegendCorner[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right']
const MAX_ICON_BYTES = 2_000_000

export interface ExportEnv {
  // Folder of the bundled built-in icons (Tabler's `icons/outline`), if this install has them.
  iconDir?: string
}

interface Parsed {
  input: string
  output?: string
  theme: 'light' | 'dark'
  paddingPx: number
  background: SvgExportOptions['background']
  legend: boolean
  corner: LegendCorner
  highlights: string[]
}

class UsageError extends Error {}

function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = {
    input: '',
    theme: 'light',
    paddingPx: DEFAULT_SVG_EXPORT_OPTIONS.paddingPx,
    background: 'theme',
    legend: true,
    corner: 'bottom-left',
    highlights: []
  }
  const value = (i: number, flag: string): string => {
    if (i + 1 >= args.length) throw new UsageError(`${flag} needs a value`)
    return args[i + 1]
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '-o' || arg === '--output') {
      parsed.output = value(i, arg)
      i += 1
    } else if (arg === '--theme') {
      const v = value(i, arg)
      if (v !== 'light' && v !== 'dark') throw new UsageError(`--theme must be light or dark`)
      parsed.theme = v
      i += 1
    } else if (arg === '--padding') {
      const n = Number(value(i, arg))
      if (!Number.isFinite(n) || n < 0)
        throw new UsageError('--padding must be a number of 0 or more')
      parsed.paddingPx = n
      i += 1
    } else if (arg === '--background') {
      const v = value(i, arg)
      if (v === 'theme' || v === 'transparent') parsed.background = v
      else if (/^#[0-9a-fA-F]{3,8}$/.test(v)) parsed.background = { color: v }
      else throw new UsageError(`--background must be theme, transparent or a #hex colour`)
      i += 1
    } else if (arg === '--no-legend') {
      parsed.legend = false
    } else if (arg === '--legend-corner') {
      const v = value(i, arg) as LegendCorner
      if (!CORNERS.includes(v))
        throw new UsageError(`--legend-corner must be one of ${CORNERS.join(', ')}`)
      parsed.corner = v
      i += 1
    } else if (arg === '--highlight') {
      parsed.highlights.push(value(i, arg))
      i += 1
    } else if (arg.startsWith('-') && arg !== '-') {
      throw new UsageError(`unknown option '${arg}'`)
    } else if (parsed.input === '') {
      parsed.input = arg
    } else {
      throw new UsageError(`unexpected argument '${arg}'`)
    }
  }
  if (parsed.input === '') throw new UsageError('no diagram file given')
  return parsed
}

// `key=value` switches on that one highlight, `key` every highlight of that key. The value is
// compared as text and as JSON, so `risk=high` and `tier=1` both work.
function enabledHighlightIds(diagram: DiagramFile, requested: string[]): string[] {
  const ids = new Set<string>()
  for (const spec of requested) {
    const eq = spec.indexOf('=')
    const key = eq === -1 ? spec : spec.slice(0, eq)
    const wanted = eq === -1 ? undefined : spec.slice(eq + 1)
    for (const h of diagram.highlights ?? []) {
      if (h.key !== key) continue
      if (
        wanted === undefined ||
        String(h.value) === wanted ||
        JSON.stringify(h.value) === wanted
      ) {
        ids.add(highlightId(h))
      }
    }
  }
  return [...ids]
}

// Icons the diagram names, read from disk. A built-in icon comes from the bundled Tabler set. A
// custom icon is a path stored in the diagram, which is untrusted (ADR 0115) and ends up inside a
// file that gets shared, so it must stay inside the diagram's folder and be a PNG or SVG; the app's
// own read-only display follows outside paths, an exported file must not carry them away. An icon
// that cannot be read is left out of the image.
function loadIcons(
  diagram: DiagramFile,
  diagramDir: string,
  legendItems: ReturnType<typeof defaultLegendItems>,
  env: ExportEnv,
  warn: (message: string) => void
): Map<string, IconAsset> {
  const icons = new Map<string, IconAsset>()
  for (const icon of collectIconRefs(diagram, legendItems)) {
    try {
      if (icon.source === 'builtin') {
        if (!env.iconDir || !/^[a-z0-9-]+$/.test(icon.id)) continue
        const file = join(env.iconDir, `${icon.id}.svg`)
        if (existsSync(file))
          icons.set(iconKey(icon), { kind: 'svg', markup: readFileSync(file, 'utf-8') })
        continue
      }
      const full = containedPath(diagramDir, icon.path)
      const ext = extname(icon.path).toLowerCase()
      if (!full || (ext !== '.png' && ext !== '.svg')) {
        warn(`icon '${icon.path}' skipped: not a PNG or SVG inside the diagram's folder`)
        continue
      }
      const bytes = readFileSync(full)
      if (bytes.length > MAX_ICON_BYTES) {
        warn(`icon '${icon.path}' skipped: larger than ${MAX_ICON_BYTES} bytes`)
        continue
      }
      const mime = ext === '.png' ? 'image/png' : 'image/svg+xml'
      icons.set(iconKey(icon), {
        kind: 'image',
        dataUrl: `data:${mime};base64,${bytes.toString('base64')}`
      })
    } catch {
      warn(`icon '${icon.source === 'custom' ? icon.path : icon.id}' skipped: not readable`)
    }
  }
  return icons
}

export function runExport(args: string[], env: ExportEnv = {}): number {
  let parsed: Parsed
  try {
    parsed = parseArgs(args)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(`chd: ${error.message}\n\n${EXPORT_USAGE}`)
    return 2
  }

  const input = resolve(parsed.input)
  let diagram: DiagramFile
  try {
    diagram = parseDiagram(readFileSync(input, 'utf-8'))
  } catch (error) {
    console.error(
      `chd: can't read '${parsed.input}': ${error instanceof Error ? error.message : error}`
    )
    return 1
  }

  const output =
    parsed.output === '-'
      ? '-'
      : resolve(parsed.output ?? join(dirname(input), basename(input, extname(input)) + '.svg'))
  if (output !== '-' && extname(output).toLowerCase() !== '.svg') {
    console.error(
      `chd: the output must be an .svg file (it never overwrites a diagram): '${output}'`
    )
    return 2
  }

  const enabled = enabledHighlightIds(diagram, parsed.highlights)
  const legendItems = parsed.legend ? defaultLegendItems(diagram, enabled) : []
  const svg = renderDiagramSvg(diagram, {
    theme: parsed.theme,
    paddingPx: parsed.paddingPx,
    background: parsed.background,
    legend: legendItems.length > 0 ? { items: legendItems, corner: parsed.corner } : undefined,
    enabledHighlightIds: enabled,
    edgeStraightSegmentLength: DEFAULT_SVG_EXPORT_OPTIONS.edgeStraightSegmentLength,
    icons: loadIcons(diagram, dirname(input), legendItems, env, (m) => console.error(`chd: ${m}`)),
    title: basename(input, extname(input))
  })

  if (output === '-') {
    process.stdout.write(svg)
    return 0
  }
  try {
    writeFileSync(output, svg, 'utf-8')
  } catch (error) {
    console.error(`chd: can't write '${output}': ${error instanceof Error ? error.message : error}`)
    return 1
  }
  console.log(output)
  return 0
}
