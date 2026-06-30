// Generates the extension icons (16/32/48/128 px) as PNG files with no external
// dependencies. Each icon is a rounded teal square with a small ascending bar
// chart — a neutral "activity tracking" motif that deliberately avoids the
// LinkedIn blue/logo. Rendered with 4x supersampling for clean anti-aliased
// edges, then encoded to PNG via Node's built-in zlib (deflate + crc32).
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [13, 148, 136] // teal-600
const BAR = [255, 255, 255]
const CORNER = 0.22 // corner radius as a fraction of the icon size
const BARS = [
  { x0: 0.20, x1: 0.37, y0: 0.56, y1: 0.79 },
  { x0: 0.42, x1: 0.59, y0: 0.40, y1: 0.79 },
  { x0: 0.64, x1: 0.81, y0: 0.26, y1: 0.79 },
]

function insideRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r)
  const cy = Math.min(Math.max(y, r), 1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function insideAnyBar(x, y) {
  for (const b of BARS) {
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true
  }
  return false
}

function drawIcon(size) {
  const ss = 4 // supersampling factor per axis
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Accumulate premultiplied-alpha samples for correct edge blending.
      let pr = 0
      let pg = 0
      let pb = 0
      let pa = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const nx = (px + (sx + 0.5) / ss) / size
          const ny = (py + (sy + 0.5) / ss) / size
          if (!insideRoundedRect(nx, ny, CORNER)) continue
          const color = insideAnyBar(nx, ny) ? BAR : BG
          pr += color[0]
          pg += color[1]
          pb += color[2]
          pa += 255
        }
      }
      const samples = ss * ss
      const a = pa / samples
      const o = (py * size + px) * 4
      if (a <= 0) {
        rgba[o] = 0
        rgba[o + 1] = 0
        rgba[o + 2] = 0
        rgba[o + 3] = 0
      } else {
        // Un-premultiply to straight alpha for PNG.
        rgba[o] = Math.round(pr / pa * 255)
        rgba[o + 1] = Math.round(pg / pa * 255)
        rgba[o + 2] = Math.round(pb / pa * 255)
        rgba[o + 3] = Math.round(a)
      }
    }
  }
  return rgba
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0, 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter type 0 (None) per scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = new URL('../public/icons/', import.meta.url)
mkdirSync(outDir, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, drawIcon(size))
  writeFileSync(new URL(`icon${size}.png`, outDir), png)
  console.log(`[icons] wrote icon${size}.png (${png.length} bytes)`)
}
