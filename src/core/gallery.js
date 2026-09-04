// gallery.js —— Marble 公共画廊世界库（14 个精选世界）
// 非示例词 → 随机抽一个：缩略图当氛围背景 + 官方 URL 可点进真 3D
// 示例词（想你/晚安/自由的风）→ 用自生成世界（见 cache.js CURATED_WORLDS）

export const GALLERY_WORLDS = [
  { id: '2c4393fe-e468-44de-9b75-b38401c2f41c', img: './worlds/gallery/2c4393fe-e468-44de-9b75-b38401c2f41c.webp', url: 'https://marble.worldlabs.ai/world/2c4393fe-e468-44de-9b75-b38401c2f41c' },
  { id: '071b2fb3-b991-4b10-af16-96b2a4abe1f7', img: './worlds/gallery/071b2fb3-b991-4b10-af16-96b2a4abe1f7.webp', url: 'https://marble.worldlabs.ai/world/071b2fb3-b991-4b10-af16-96b2a4abe1f7' },
  { id: 'a10e86fa-7e76-4a46-9bd7-85251bd200b1', img: './worlds/gallery/a10e86fa-7e76-4a46-9bd7-85251bd200b1.webp', url: 'https://marble.worldlabs.ai/world/a10e86fa-7e76-4a46-9bd7-85251bd200b1' },
  { id: '6425f0fd-fed4-4569-9d92-1ea90f5627d0', img: './worlds/gallery/6425f0fd-fed4-4569-9d92-1ea90f5627d0.webp', url: 'https://marble.worldlabs.ai/world/6425f0fd-fed4-4569-9d92-1ea90f5627d0' },
  { id: '889a5974-c395-4a6a-a401-e2d6aec4f12b', img: './worlds/gallery/889a5974-c395-4a6a-a401-e2d6aec4f12b.webp', url: 'https://marble.worldlabs.ai/world/889a5974-c395-4a6a-a401-e2d6aec4f12b' },
  { id: 'a342be72-fb42-4289-b335-71462f8445df', img: './worlds/gallery/a342be72-fb42-4289-b335-71462f8445df.webp', url: 'https://marble.worldlabs.ai/world/a342be72-fb42-4289-b335-71462f8445df' },
  { id: 'f32f01ae-ac64-44c6-8a0a-8ca502ebfe9d', img: './worlds/gallery/f32f01ae-ac64-44c6-8a0a-8ca502ebfe9d.webp', url: 'https://marble.worldlabs.ai/world/f32f01ae-ac64-44c6-8a0a-8ca502ebfe9d' },
  { id: '813200d1-1c25-4b8c-a107-7f22fdc30377', img: './worlds/gallery/813200d1-1c25-4b8c-a107-7f22fdc30377.webp', url: 'https://marble.worldlabs.ai/world/813200d1-1c25-4b8c-a107-7f22fdc30377' },
  { id: '4590e44e-07cc-45b8-b0d0-276ef65310de', img: './worlds/gallery/4590e44e-07cc-45b8-b0d0-276ef65310de.webp', url: 'https://marble.worldlabs.ai/world/4590e44e-07cc-45b8-b0d0-276ef65310de' },
  { id: 'f58fd04a-c628-40a0-b83b-1daaa17f03af', img: './worlds/gallery/f58fd04a-c628-40a0-b83b-1daaa17f03af.webp', url: 'https://marble.worldlabs.ai/world/f58fd04a-c628-40a0-b83b-1daaa17f03af' },
  { id: '8f80bc61-7953-435a-acb8-06d43737bed8', img: './worlds/gallery/8f80bc61-7953-435a-acb8-06d43737bed8.webp', url: 'https://marble.worldlabs.ai/world/8f80bc61-7953-435a-acb8-06d43737bed8' },
  { id: '660f680d-c31f-4463-8285-b61ad406739e', img: './worlds/gallery/660f680d-c31f-4463-8285-b61ad406739e.webp', url: 'https://marble.worldlabs.ai/world/660f680d-c31f-4463-8285-b61ad406739e' },
  { id: '24166d4f-76a8-49a4-b894-2bb18d46af04', img: './worlds/gallery/24166d4f-76a8-49a4-b894-2bb18d46af04.webp', url: 'https://marble.worldlabs.ai/world/24166d4f-76a8-49a4-b894-2bb18d46af04' },
  { id: '3883f06a-ccdb-439a-bef7-ce452d69bad3', img: './worlds/gallery/3883f06a-ccdb-439a-bef7-ce452d69bad3.webp', url: 'https://marble.worldlabs.ai/world/3883f06a-ccdb-439a-bef7-ce452d69bad3' },
]

// 随机抽一个画廊世界（带确定性：同一 seed 抽同一个，避免每次刷新换）
export function pickGalleryWorld(seed) {
  const r = (seed % GALLERY_WORLDS.length + GALLERY_WORLDS.length) % GALLERY_WORLDS.length
  return GALLERY_WORLDS[r]
}
