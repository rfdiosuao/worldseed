// 标准 .splat (32B/点) → markkellogg .ksplat (44B/点, compressionLevel 0)
// 标准格式: pos(12B f32) + scale(12B f32) + color(4B u8) + rot(4B i8) = 32B
// ksplat 格式: 1024B 头 + pos(12B f32) + scale(12B f32) + color(4B u8) + rot(16B f32) = 44B/点
import { readFileSync, writeFileSync, statSync } from 'fs'

const src = process.argv[2]
const dst = process.argv[3]
if (!src || !dst) { console.error('usage: node splat2ksplat.mjs <in.splat> <out.ksplat>'); process.exit(1) }

const buf = readFileSync(src)
const n = buf.length
if (n % 32 !== 0) { console.error('not a standard 32B/point .splat, size:', n); process.exit(1) }
const count = n / 32
console.log('points:', count, 'size:', n)

// ---- 转换 ----
const out = Buffer.alloc(1024 + count * 44)
// 头部: versionMajor=1, versionMinor=0, headerExtraK=0, compressionLevel=0
out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0
out.writeUInt32LE(count, 4)        // splatCount (uint32 offset 4 = headerArrayUint32[1])
// bucketCount=0, bucketSize=0, bucketBlockSize=0, bytesPerBucket=0 —— 不分区

for (let i = 0; i < count; i++) {
  const s = i * 32
  const d = 1024 + i * 44
  // pos 12B 原样拷贝
  buf.copy(out, d, s, s + 12)
  // scale 12B 原样拷贝
  buf.copy(out, d + 12, s + 12, s + 24)
  // color 4B 原样拷贝
  buf.copy(out, d + 24, s + 24, s + 28)
  // rotation: int8×4 → float32×4 (/128)
  for (let c = 0; c < 4; c++) {
    const v = buf.readInt8(s + 28 + c) / 128
    out.writeFloatLE(v, d + 28 + c * 4)
  }
}
writeFileSync(dst, out)
console.log('wrote', dst, out.length, 'bytes')
