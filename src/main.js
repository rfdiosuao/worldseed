// main.js —— 一念成界 · Worldseed 状态机
// INPUT → GROWING → WORLD → SEAL；hash 分享直达；缓存命中秒开；?fast=1 调试加速
import './style.css'
import { buildRecipe, recipeFromHash } from './core/recipe.js'
import { getCached, setCached, prefillLibrary } from './state/cache.js'
import { WorldScene } from './render/scene.js'
import { mountCard, buildShareUrl } from './ui/card.js'

const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
const FAST = params.get('fast') === '1'
const growOverride = parseInt(params.get('grow') || '', 10)
const GROW_MS = growOverride > 0 ? growOverride : (FAST ? 3200 : 30000)

let scene = null
let currentRecipe = null
let genId = 0

// ---------- 启动 ----------
prefillLibrary()
setupGlowOrbs()
boot()

function boot() {
  if (location.hash.startsWith('#w=')) {
    const recipe = recipeFromHash(location.hash.slice(3))
    if (recipe) {
      currentRecipe = recipe
      setCached(recipe.seed, { at: Date.now(), shared: true })
      enterWorld(recipe, { instant: true })
      return
    }
  }
  goInput()
}

// ---------- 舞台 ----------
function mountOverlay(html) {
  let ov = document.getElementById('overlay')
  if (!ov) {
    ov = document.createElement('div')
    ov.id = 'overlay'
    app.appendChild(ov)
  }
  ov.innerHTML = html
  return ov
}

function ensureScene() {
  if (scene) return scene
  let wc = document.getElementById('wc')
  if (!wc) {
    wc = document.createElement('div')
    wc.id = 'wc'
    wc.className = 'world-canvas hidden'
    app.prepend(wc)
  }
  wc.classList.remove('hidden')
  try {
    scene = new WorldScene(wc)
  } catch (e) {
    console.error('[worldseed] WebGL 不可用：', e)
    scene = null
    wc.classList.add('hidden')
    toast('当前设备不支持 3D 渲染，已切换至离线模式')
  }
  return scene
}

function showWorldCanvas(show) {
  const wc = document.getElementById('wc')
  if (wc) wc.classList.toggle('hidden', !show)
}

// ---------- ① 输入 ----------
function goInput() {
  genId++
  if (scene) { scene.dispose(); scene = null }
  showWorldCanvas(false)
  const ov = mountOverlay(`
    <div class="stage" id="stage-input">
      <div class="hero-inner">
        <span class="badge">Eazo 数字艺术黑客松 · WORLDSEED</span>
        <h1 class="slogan">说一句话，30 秒<br/>长出<em>一个能走进去的世界</em></h1>
        <p class="sub">封存成卡片，寄给那个<strong>你想让他懂你</strong>的人。</p>
        <div class="input-wrap">
          <input id="seed" class="seed-input" maxlength="30" placeholder="写下那句说不出口的话…" autocomplete="off" />
          <div class="input-actions">
            <span id="charcnt" class="char-count">0/30</span>
            <button id="gobtn" class="cta" disabled>生成世界</button>
          </div>
        </div>
        <div class="chips" id="chips"></div>
      </div>
    </div>
  `)
  const input = ov.querySelector('#seed')
  const btn = ov.querySelector('#gobtn')
  const cnt = ov.querySelector('#charcnt')
  const chips = ov.querySelector('#chips')
  const SEED_CHIPS = ['想你', '晚安', '对不起', '自由的风', '一个人的海']
  chips.innerHTML = `<span class="chip-tag">试一句：</span>` + SEED_CHIPS.map(c => `<button class="chip" data-t="${c}">${c}</button>`).join('')
  const sync = () => {
    const n = input.value.trim().length
    cnt.textContent = `${n}/30`
    cnt.classList.toggle('warn', n > 24)
    btn.disabled = n === 0
  }
  input.addEventListener('input', sync)
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) startGenerate(input.value.trim()) })
  btn.addEventListener('click', () => startGenerate(input.value.trim()))
  chips.addEventListener('click', e => {
    const t = e.target.closest('.chip')
    if (t) { input.value = t.dataset.t; sync(); input.focus() }
  })
  setTimeout(() => input && input.focus(), 400)
}

// ---------- 生成入口：缓存命中秒开，否则生长 ----------
function startGenerate(text) {
  const recipe = buildRecipe(text)
  currentRecipe = recipe
  const cached = getCached(recipe.seed)
  if (cached) {
    // 命中 → 秒开直进世界（主路径）
    enterWorld(recipe, { instant: true })
  } else {
    setCached(recipe.seed, { at: Date.now() })
    enterGrowing(recipe)
  }
}

// ---------- ② 生长 ----------
function enterGrowing(recipe) {
  genId++
  const myGen = genId
  showWorldCanvas(true)
  ensureScene()
  if (!scene) return goInput()
  scene.setWorld(recipe)
  const ov = mountOverlay(`
    <div class="stage" id="stage-grow">
      <div class="grow-inner">
        <h2 class="grow-title">世界正在生长…</h2>
        <div class="narration" id="narration">
          ${recipe.narration.map(n => `<span class="n-line${n.startsWith('「') ? ' sub' : ''}">${n}</span>`).join('')}
        </div>
        <div class="grow-progress"><i id="growbar"></i></div>
        <p class="grow-tip">山川正在成形，光正找到回家的路</p>
      </div>
    </div>
  `)
  const bar = ov.querySelector('#growbar')
  const lines = [...ov.querySelectorAll('.n-line')]
  const dur = GROW_MS
  scene.startGrowth(dur, p => {
    if (genId !== myGen) return
    bar.style.width = (p * 100).toFixed(1) + '%'
    const idx = Math.min(lines.length - 1, Math.floor(p * lines.length))
    lines.forEach((el, i) => el.classList.toggle('on', i <= idx))
    if (p >= 1 && scene) {
      setTimeout(() => { if (genId === myGen) enterWorld(recipe) }, 380)
    }
  })
}

// ---------- ③ 世界（漫游） ----------
function enterWorld(recipe, { instant = false } = {}) {
  genId++
  const myGen = genId
  showWorldCanvas(true)
  ensureScene()
  if (!scene) return goInput()
  scene.setWorld(recipe)
  if (instant) scene.startGrowth(900) // 秒开也有一段极短生长仪式（不阻塞，~0.9s）
  const ov = mountOverlay(`
    <div class="world-hud">
      <div class="hud-left">
        <div class="hud-mood">${recipe.moodLabel} · ${recipe.form} · ${recipe.light}</div>
        <div class="hud-text">「${recipe.text}」</div>
      </div>
      <div class="hud-actions">
        <button id="btnSeal" class="btn-ghost">封存成卡片</button>
        <button id="btnAgain" class="btn-ghost">换个念头</button>
      </div>
    </div>
  `)
  ov.querySelector('#btnSeal').addEventListener('click', () => goSeal(recipe))
  ov.querySelector('#btnAgain').addEventListener('click', goInput)
  if (myGen === genId) qualityWatchdog()
}

// ---------- ④ 封存 ----------
function goSeal(recipe) {
  genId++
  const ov = mountOverlay(`
    <div class="stage seal-stage" id="stage-seal">
      <h2 class="seal-title">封存成卡片</h2>
      <p class="seal-sub">这个世界已被折叠进一张卡片，扫一扫就能走进来。</p>
      <div id="sealMount"></div>
      <div class="seal-actions">
        <button id="btnCopy" class="btn-ghost">复制链接</button>
        <button id="btnBack" class="cta">回到输入</button>
      </div>
    </div>
  `)
  const { url } = mountCard(ov.querySelector('#sealMount'), recipe)
  ov.querySelector('#btnCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('链接已复制') }
    catch { window.prompt('复制链接：', url) }
  })
  ov.querySelector('#btnBack').addEventListener('click', goInput)
}

// ---------- 质量看门狗：30 帧采样，<30fps 降级 ----------
function qualityWatchdog() {
  if (!scene) return
  let n = 0, t0 = performance.now()
  const step = () => {
    n++
    if (n < 30) return requestAnimationFrame(step)
    const dt = (performance.now() - t0) / n
    if (dt > 34) { scene.degrade(); toast('已为你切换流畅模式') }
  }
  requestAnimationFrame(step)
}

// ---------- 金色光斑 ----------
function setupGlowOrbs() {
  const orb1 = document.createElement('div')
  orb1.className = 'glow-orb'
  const orb2 = document.createElement('div')
  orb2.className = 'glow-orb orb-2'
  document.body.append(orb1, orb2)
  let tx = innerWidth * 0.3, ty = innerHeight * 0.35
  window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY }, { passive: true })
  const tick = () => {
    orb1.style.left = tx + 'px'
    orb1.style.top = ty + 'px'
    orb2.style.left = (innerWidth - tx) * 0.9 + 'px'
    orb2.style.top = (innerHeight - ty) * 0.75 + 'px'
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ---------- toast ----------
function toast(msg) {
  let t = document.getElementById('toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'toast'
    t.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:200;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.16);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;backdrop-filter:blur(8px);opacity:0;transition:opacity .3s;pointer-events:none'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.opacity = '1'
  clearTimeout(t._h)
  t._h = setTimeout(() => { t.style.opacity = '0' }, 1800)
}
