// cache.js —— localStorage 本地缓存：命中秒开（目标 ≤800ms），零后端
import { buildRecipe } from '../core/recipe.js'

const PREFIX = 'worldseed:v1:'

export function cacheKey(seed) { return PREFIX + seed }

export function getCached(seed) {
  try {
    const raw = localStorage.getItem(cacheKey(seed))
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}

export function setCached(seed, data) {
  try { localStorage.setItem(cacheKey(seed), JSON.stringify(data)) } catch (e) { /* 容量满则静默 */ }
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
  } catch (e) {}
}

// 预填充世界库（演示金句）：key 必须与 startGenerate 的 buildRecipe().seed 完全一致，
// 否则金句永远命中不了缓存。有真实资产的金句 → 秒开真实世界（全景兜底为主路径）；
// 无真实资产的金句 → 秒开 2.5D（不黑屏）。
const CURATED_WORLDS = {
  '想你': { pano: './worlds/w-xiangni-pano.jpg', spzUrl: './worlds/w-xiangni-100k.spz', url: 'https://marble.worldlabs.ai/world/1a46e1b3-9ea5-4618-8f66-8dac7574c8c1' },
  '晚安': { pano: './worlds/w-wanan-pano.jpg', spzUrl: './worlds/w-wanan-100k.spz', url: 'https://marble.worldlabs.ai/world/641660bb-bfe1-4944-a3d3-f439068b9f63' },
  '自由的风': { pano: './worlds/w-ziyou-pano.jpg', spzUrl: './worlds/w-ziyou-100k.spz', url: 'https://marble.worldlabs.ai/world/875a39a9-4fe2-4939-bec1-8676fa563e7a' },
}
export function prefillLibrary() {
  const curated = ['想你', '晚安', '对不起', '自由的风', '一个人的海']
  for (const t of curated) {
    const seed = buildRecipe(t).seed
    const w = CURATED_WORLDS[t] || {}
    setCached(seed, { prefilled: true, at: Date.now(), pano: w.pano || '', spzUrl: w.spzUrl || '', url: w.url || '' })
  }
}
