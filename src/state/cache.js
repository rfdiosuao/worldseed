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
// 否则金句永远命中不了缓存。首次打开即写入 → 现场输入这些句子 = 秒开直进世界。
export function prefillLibrary() {
  const curated = ['想你', '晚安', '对不起', '自由的风', '一个人的海']
  for (const t of curated) {
    const seed = buildRecipe(t).seed
    setCached(seed, { prefilled: true, at: Date.now() })
  }
}
