// Regenerates every app icon file from the one SVG master (ADR 0122):
//   npm run icons
// Writes build/icon.png, build/icon.ico, build/icon.icns and resources/icon.png.
// Runs under Electron because its Chromium renders the SVG; no extra dependency is needed.
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const SVG = path.join(root, 'build', 'icon.svg')

// Draws the SVG on a canvas of `size` px (artwork scaled by `scale`, centred) and returns PNG
// bytes, or the raw RGBA pixels when `raw` is set. Done in the page so alpha is kept exactly.
const drawScript = (dataUrl, size, scale, raw) => `
new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = c.height = ${size}
    const g = c.getContext('2d')
    g.imageSmoothingQuality = 'high'
    const s = ${size} * ${scale}
    const o = (${size} - s) / 2
    g.drawImage(img, o, o, s, s)
    if (!${raw}) return resolve(c.toDataURL('image/png').split(',')[1])
    const px = g.getImageData(0, 0, ${size}, ${size}).data
    let bin = ''
    for (let i = 0; i < px.length; i += 8192) bin += String.fromCharCode.apply(null, px.subarray(i, i + 8192))
    resolve(btoa(bin))
  }
  img.onerror = reject
  img.src = ${JSON.stringify(dataUrl)}
})`

// Windows icon: 32-bit BMP entries up to 128 px (what the NSIS installer tooling expects) and a
// PNG entry for 256 px.
function buildIco(entries) {
  const dir = Buffer.alloc(6 + 16 * entries.length)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(entries.length, 4)
  let offset = dir.length
  entries.forEach(({ size, data }, i) => {
    const o = 6 + 16 * i
    dir[o] = dir[o + 1] = size === 256 ? 0 : size
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([dir, ...entries.map((e) => e.data)])
}

function bmpEntry(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // the height also counts the AND mask
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(size * size * 4, 20)
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4
      const d = ((size - 1 - y) * size + x) * 4 // BMP rows run bottom-up, pixels are BGRA
      pixels[d] = rgba[s + 2]
      pixels[d + 1] = rgba[s + 1]
      pixels[d + 2] = rgba[s]
      pixels[d + 3] = rgba[s + 3]
    }
  }
  return Buffer.concat([header, pixels, Buffer.alloc(Math.ceil(size / 32) * 4 * size)])
}

app.disableHardwareAcceleration()
app
  .whenReady()
  .then(async () => {
    const dataUrl = 'data:image/svg+xml;base64,' + fs.readFileSync(SVG).toString('base64')
    const win = new BrowserWindow({ show: false, width: 100, height: 100 })
    await win.loadURL('data:text/html,<html></html>')
    const png = async (size, scale = 1) =>
      Buffer.from(
        await win.webContents.executeJavaScript(drawScript(dataUrl, size, scale, false)),
        'base64'
      )
    const rgba = async (size) =>
      Buffer.from(
        await win.webContents.executeJavaScript(drawScript(dataUrl, size, 1, true)),
        'base64'
      )

    // Windows and Linux icons are full-bleed; the window icon is the same image at 512 px.
    fs.writeFileSync(path.join(root, 'build', 'icon.png'), await png(1024))
    fs.writeFileSync(path.join(root, 'resources', 'icon.png'), await png(512))

    const ico = []
    for (const size of [16, 24, 32, 48, 64, 128])
      ico.push({ size, data: bmpEntry(size, await rgba(size)) })
    ico.push({ size: 256, data: await png(256) })
    fs.writeFileSync(path.join(root, 'build', 'icon.ico'), buildIco(ico))

    // macOS icons sit on a grid: the artwork fills 824 of 1024 px and the rest is transparent.
    const grid = 824 / 1024
    const types = [
      ['icp4', 16],
      ['icp5', 32],
      ['icp6', 64],
      ['ic07', 128],
      ['ic08', 256],
      ['ic09', 512],
      ['ic10', 1024],
      ['ic11', 32],
      ['ic12', 64],
      ['ic13', 256],
      ['ic14', 512]
    ]
    const chunks = []
    for (const [type, size] of types) {
      const data = await png(size, grid)
      const head = Buffer.alloc(8)
      head.write(type, 0, 'ascii')
      head.writeUInt32BE(data.length + 8, 4)
      chunks.push(head, data)
    }
    const body = Buffer.concat(chunks)
    const top = Buffer.alloc(8)
    top.write('icns', 0, 'ascii')
    top.writeUInt32BE(body.length + 8, 4)
    fs.writeFileSync(path.join(root, 'build', 'icon.icns'), Buffer.concat([top, body]))

    console.log('icons written to build/ and resources/')
    app.quit()
  })
  .catch((e) => {
    console.error(e)
    app.exit(1)
  })
