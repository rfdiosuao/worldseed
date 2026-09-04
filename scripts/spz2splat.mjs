// spz2splat.mjs —— Marble .spz → 标准 .splat（32B/点）转换器
// .spz = gzip(NGSP 格式)：解压 → 解析 header + sections → 组装标准 .splat
// 用途：绕过 @mkkellogg/gaussian-splats-3d 的慢速 SpzLoader（实测 >60s），
//       转成它 2 秒级能解析的 .splat（27 万点实测 SplatTree build 2.1s）。
import { readFileSync, writeFileSync } from 'fs'
import { gunzipSync } from 'zlib'

const src = process.argv[2]
const dst = process.argv[3]
if (!src || !dst) { console.error('usage: node spz2splat.mjs <in.spz> <out.splat>'); process.exit(1) }

let buf = readFileSync(src)
console.log('input:', buf.length, 'bytes')

// gzip 解压（Marble .spz 是 gzip 包裹的 NGSP）
if (buf[0] === 0x1f && buf[1] === 0x8b) {
  buf = gunzipSync(buf)
  console.log('gunzipped →', buf.length, 'bytes')
}

// ---- NGSP header ----
const magic = buf.toString('ascii', 0, 4)
if (magic !== 'NGSP') { console.error('bad magic:', magic); process.exit(1) }
const version = buf.readUInt16LE(4)
const headerSize = buf.readUInt16LE(6)
const numPoints = buf.readUInt32LE(8)
const shDegree = buf.readUInt32LE(12)
console.log({ magic, version, headerSize, numPoints, shDegree })

// ---- sections ----
const sections = { 0: [], 1: [], 2: [], 3: [] } // 0=pos 1=scale 2=color 3=rot
let pos = headerSize
while (pos + 8 <= buf.length) {
  const sectionId = buf.readUInt32LE(pos)
  const sectionSize = buf.readUInt32LE(pos + 4)
  const d = pos + 8
  if (sectionId === 0) { // positions: 3×int32（21 位有符号，fractional 12）
    for (let i = 0; i < numPoints; i++) {
      sections[0].push(
        buf.readInt32LE(d + i * 12) * 2 ** -12,
        buf.readInt32LE(d + i * 12 + 4) * 2 ** -12,
        buf.readInt32LE(d + i * 12 + 8) * 2 ** -12,
      )
    }
  } else if (sectionId === 1) { // scales: 3×uint32（fractional 15）
    for (let i = 0; i < numPoints; i++) {
      sections[1].push(
        buf.readUInt32LE(d + i * 12) * 2 ** -15,
        buf.readUInt32LE(d + i * 12 + 4) * 2 ** -15,
        buf.readUInt32LE(d + i * 12 + 8) * 2 ** -15,
      )
    }
  } else if (sectionId === 2) { // colors: uint32 RGBA（8bit each）
    for (let i = 0; i < numPoints; i++) {
      const c = buf.readUInt32LE(d + i * 4)
      sections[2].push((c >>> 0) & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, (c >>> 24) & 0xff)
    }
  } else if (sectionId === 3) { // rotations: uint32 → 4×int8 /128
    for (let i = 0; i < numPoints; i++) {
      const r = buf.readUInt32LE(d + i * 4)
      sections[3].push(
        ((r >>> 0) & 0xff) - 128, ((r >>> 8) & 0xff) - 128,
        ((r >>> 16) & 0xff) - 128, ((r >>> 24) & 0xff) - 128,
      )
    }
  }
  // section 4+ = SH（跳过，.splat 无 SH）
  pos = d + sectionSize
}

const have = Object.entries(sections).map(([k, v]) => `${k}:${v.length / (k === '2' ? 4 : 3)}`).join(' ')
console.log('sections parsed:', have)

// ---- 组装标准 .splat：pos f32×3 + scale f32×3 + color u8×4 + rot i8×4 = 32B/点 ----
const out = Buffer.alloc(numPoints * 32)
for (let i = 0; i < numPoints; i++) {
  const o = i * 32
  if (sections[0].length) { out.writeFloatLE(sections[0][i*3], o); out.writeFloatLE(sections[0][i*3+1], o+4); out.writeFloatLE(sections[0][i*3+2], o+8) }
  if (sections[1].length) { out.writeFloatLE(sections[1][i*3], o+12); out.writeFloatLE(sections[1][i*3+1], o+16); out.writeFloatLE(sections[1][i*3+2], o+20) }
  if (sections[2].length) { out[o+24]=sections[2][i*4]; out[o+25]=sections[2][i*4+1]; out[o+26]=sections[2][i*4+2]; out[o+27]=sections[2][i*4+3] }
  if (sections[3].length) { out[o+28]=sections[3][i*4]; out[o+29]=sections[3][i*4+1]; out[o+30]=sections[3][i*4+2]; out[o+31]=sections[3][i*4+3] }
}
writeFileSync(dst, out)
console.log('wrote', dst, out.length, 'bytes')
