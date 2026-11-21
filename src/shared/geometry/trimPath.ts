// Shortens an SVG path string at either end, so a line can stop short of the tip of a pointed
// arrowhead (ADR 0197). Reads only the commands this app writes (M, L, C, Q: edgePath.ts,
// bendablePath.ts, orthogonalPath.ts); a string it cannot read comes back unchanged.

interface Point {
  x: number
  y: number
}

// One drawn piece with the point it starts from: 1 point after the start is a line, 2 a quadratic
// curve, 3 a cubic.
type Piece = Point[]

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

function parse(d: string): Piece[] | null {
  // Anything that is not one of the four commands (an arc, a close) makes the string unreadable.
  if (/[^MLCQ0-9eE.,+\-\s]/.test(d)) return null
  const pieces: Piece[] = []
  let current: Point | null = null
  const commands = d.match(/[MLCQ][^MLCQ]*/g)
  for (const command of commands ?? []) {
    const letter = command[0]
    const numbers = (command.slice(1).match(NUMBER) ?? []).map(Number)
    if (numbers.some((n) => !Number.isFinite(n))) return null
    const points: Point[] = []
    for (let i = 0; i + 1 < numbers.length; i += 2)
      points.push({ x: numbers[i], y: numbers[i + 1] })
    if (letter === 'M') {
      if (points.length !== 1) return null
      current = points[0]
      continue
    }
    const wanted = letter === 'L' ? 1 : letter === 'Q' ? 2 : 3
    if (!current || points.length !== wanted) return null
    pieces.push([current, ...points])
    current = points[points.length - 1]
  }
  return pieces.length > 0 ? pieces : null
}

function format(pieces: Piece[]): string {
  const n = (v: number): string => String(Math.round(v * 1000) / 1000)
  const point = (p: Point): string => `${n(p.x)},${n(p.y)}`
  let d = `M${point(pieces[0][0])}`
  for (const piece of pieces) {
    const letter = piece.length === 2 ? 'L' : piece.length === 3 ? 'Q' : 'C'
    d += ` ${letter}${piece.slice(1).map(point).join(' ')}`
  }
  return d
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

// Length of a piece: exact for a line, a close estimate for a curve (the mean of the chord and the
// control polygon), which is plenty for a trim a few pixels long.
function lengthOf(piece: Piece): number {
  const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
  const chord = dist(piece[0], piece[piece.length - 1])
  if (piece.length === 2) return chord
  let polygon = 0
  for (let i = 1; i < piece.length; i++) polygon += dist(piece[i - 1], piece[i])
  return (chord + polygon) / 2
}

// The part of the piece from its start up to the fraction t of the way along (de Casteljau).
function head(piece: Piece, t: number): Piece {
  if (piece.length === 2) return [piece[0], lerp(piece[0], piece[1], t)]
  if (piece.length === 3) {
    const [p0, p1, p2] = piece
    const a = lerp(p0, p1, t)
    const b = lerp(p1, p2, t)
    return [p0, a, lerp(a, b, t)]
  }
  const [p0, p1, p2, p3] = piece
  const a = lerp(p0, p1, t)
  const b = lerp(p1, p2, t)
  const c = lerp(p2, p3, t)
  const ab = lerp(a, b, t)
  const bc = lerp(b, c, t)
  return [p0, a, ab, lerp(ab, bc, t)]
}

const reversed = (pieces: Piece[]): Piece[] => pieces.map((p) => [...p].reverse()).reverse()

// Removes `distance` from the end of the last piece. A trim as long as the piece (or longer) is cut
// down to half of it, so a very short edge keeps a stub.
function trimEnd(pieces: Piece[], distance: number): void {
  if (distance <= 0) return
  const last = pieces[pieces.length - 1]
  const length = lengthOf(last)
  if (length <= 0) return
  const kept = Math.max(length - distance, length / 2)
  pieces[pieces.length - 1] = head(last, kept / length)
}

export function trimPath(d: string, startDistance: number, endDistance: number): string {
  if (startDistance <= 0 && endDistance <= 0) return d
  const pieces = parse(d)
  if (!pieces) return d
  trimEnd(pieces, endDistance)
  if (startDistance > 0) {
    const flipped = reversed(pieces)
    trimEnd(flipped, startDistance)
    return format(reversed(flipped))
  }
  return format(pieces)
}
