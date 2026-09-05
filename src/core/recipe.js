// recipe.js —— 世界配方：一句话 → 稳定种子 + 情绪 + 调色板 + 英文场景 prompt + 中文旁白
// P0 用确定性词法映射（无 API 也能跑）；预留 LLM 注入点，后续接豆包/OpenAI。

// ---- 工具：字符串 hash（FNV-1a）→ 32bit 种子 ----
export function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ---- 确定性 PRNG（mulberry32）----
export function rngFromSeed(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- 情绪词表（中文词法 → 情绪类型）----
const MOOD_LEXICON = {
  '思念': 'longing', '想你': 'longing', '想他': 'longing', '想你': 'longing',
  '温柔': 'tender', '柔软': 'tender', '晚安': 'tender', '谢谢': 'tender',
  '孤独': 'lonely', '一个人': 'lonely', '空': 'lonely', '寂寞': 'lonely',
  '热烈': 'fervent', '爱': 'fervent', '燃烧': 'fervent', '心跳': 'fervent',
  '希望': 'hopeful', '未来': 'hopeful', '明天': 'hopeful', '光': 'hopeful',
  '遗憾': 'melancholy', '错过': 'melancholy', '对不起': 'melancholy', '如果': 'melancholy',
  '自由': 'free', '风': 'free', '远方': 'free', '流浪': 'free',
  '平静': 'calm', '海': 'calm', '雨': 'calm', '慢': 'calm',
}

// 情绪 → 配色方案（主色/副色/光晕色/粒子色）
const MOOD_PALETTES = {
  longing:   { primary: '#7c6cf0', secondary: '#3d3a6b', glow: '#a78bfa', particle: '#8b7cf8', label: '思念' },
  tender:    { primary: '#f0a6c0', secondary: '#5c3a4e', glow: '#ffb3c8', particle: '#f8a0bc', label: '温柔' },
  lonely:    { primary: '#4a6fa5', secondary: '#1d2735', glow: '#6ba3e0', particle: '#5a86c0', label: '孤独' },
  fervent:   { primary: '#ff6b4a', secondary: '#4a1f14', glow: '#ff8a5c', particle: '#ff7a52', label: '热烈' },
  hopeful:   { primary: '#4ade80', secondary: '#14321f', glow: '#86efac', particle: '#5fe08c', label: '希望' },
  melancholy:{ primary: '#8a7fa8', secondary: '#2a2640', glow: '#a89ad0', particle: '#8f84b8', label: '遗憾' },
  free:      { primary: '#38bdf8', secondary: '#123247', glow: '#7dd3fc', particle: '#4cc3f0', label: '自由' },
  calm:      { primary: '#5eead4', secondary: '#0f3a36', glow: '#99f6e4', particle: '#6ee7d8', label: '平静' },
  solemn:    { primary: '#5a5f8a', secondary: '#23263f', glow: '#c9b37a', particle: '#8a93bd', label: '庄严' },
  ethereal:  { primary: '#9fc0d6', secondary: '#2c3a45', glow: '#e9f3f8', particle: '#cfe0ea', label: '空灵' },
}
const DEFAULT_MOOD = 'tender'

// 场景地形形态（由种子决定，给 2.5D 世界与未来 Marble prompt 共用）
const FORMS = ['岛', '山谷', '高原', '裂谷', '台地', '丘陵']
const LIGHTS = ['晨光', '暮色', '月光', '星辉', '薄雾', '极光']
const TEMPS = ['温暖', '清冷', '湿润', '干燥', '凛冽', '和煦']

// ---- 主函数：一句话 → 世界配方 ----
export function buildRecipe(text, opts = {}) {
  const src = (opts.overrideText || text || '一念之间').trim()
  const seed = hash32(src + '|' + (opts.salt || 'worldseed-v1'))
  const rng = rngFromSeed(seed)

  // 情绪：词法命中优先，否则种子兜底
  let mood = DEFAULT_MOOD
  if (opts.moodOverride && MOOD_PALETTES[opts.moodOverride]) mood = opts.moodOverride
  else for (const kw of Object.keys(MOOD_LEXICON)) {
    if (src.includes(kw)) { mood = MOOD_LEXICON[kw]; break }
  }
  const palette = MOOD_PALETTES[mood]

  const form = FORMS[Math.floor(rng() * FORMS.length)]
  const light = LIGHTS[Math.floor(rng() * LIGHTS.length)]
  const temp = TEMPS[Math.floor(rng() * TEMPS.length)]
  const terrainSeed = Math.floor(rng() * 100000)

  // 英文场景 prompt（给未来 Marble World API：/marble/v1/worlds:generate）
  const scenePrompt = `A serene ${mood} ${form} in ${light}, ${temp} atmosphere, floating islands with soft glowing edges, tiny drifting light particles like fireflies, dreamy cinematic haze, painterly volumetric light, ethereal minimalist fantasy landscape, wide open sky with a gentle gradient, highly detailed, emotional ambient mood, no people, no text`

  // 中文旁白（生长叙事，GROWING 阶段逐条浮现）
  const narration = [
    `「${src}」`,
    `${palette.label}正在汇聚……`,
    `${form}在${light}中成形`,
    `${temp}的风穿过世界`,
    `你的世界，长出来了`,
  ]

  return {
    text: src,
    seed,
    mood,
    moodLabel: palette.label,
    palette,
    form,
    light,
    temp,
    terrainSeed,
    scenePrompt,
    narration,
    schema: 1,
  }
}

// ---- 把配方编码进 URL hash（零后端分享：对方打开同一静态页即可重建，含全景/3D 资产）----
export function recipeToHash(recipe) {
  const payload = JSON.stringify({
    t: recipe.text, s: recipe.seed, m: recipe.mood,
    f: recipe.form, l: recipe.light, p: recipe.terrainSeed, v: recipe.schema,
    pano: recipe.panoUrl || '', spz: recipe.spzUrl || '', url: recipe.worldMarbleUrl || '',
  })
  return btoa(unescape(encodeURIComponent(payload))) // UTF-8 → base64
}

export function recipeFromHash(hash) {
  try {
    const json = decodeURIComponent(escape(atob(hash)))
    const d = JSON.parse(json)
    const recipe = buildRecipe(d.t, { salt: 'worldseed-v1' })
    if (d.pano) recipe.panoUrl = d.pano
    if (d.spz) recipe.spzUrl = d.spz
    if (d.url) recipe.worldMarbleUrl = d.url
    return recipe
  } catch (e) {
    return null
  }
}
