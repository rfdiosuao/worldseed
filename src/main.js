// main.js —— 一念成界 · Worldseed 状态机
// INPUT → GROWING → WORLD → SEAL；hash 分享直达；缓存命中秒开；?fast=1 调试加速
import './style.css'
import heroBgUrl from './assets/hero-bg.jpg'
import { buildRecipe, recipeFromHash, rngFromSeed } from './core/recipe.js'
import { pickGalleryWorld } from './core/gallery.js'
import { getCached, setCached, prefillLibrary } from './state/cache.js'
import { WorldScene } from './render/scene.js'
import { tryLoadSplat, disposeSplat } from './render/splat.js'
import { mountCard, buildShareUrl } from './ui/card.js'
import { createGrowParticles } from './ui/growParticles.js'
import { generateWorld, pollOperation, marbleConfigured, MarbleApiError } from './core/marble.js'

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
preloadHeroBg()
boot()

// 预加载 hero 高清背景：就绪后触发「模糊→清晰」动画，后续返回输入页直接清晰
function preloadHeroBg() {
  const img = new Image()
  img.onload = () => {
    window.__heroLoaded = true
    document.querySelectorAll('.hero-bg').forEach(el => el.classList.add('loaded'))
  }
  img.src = heroBgUrl // Vite 处理过的 hashed URL，build 后仍正确
}

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
  // 离开世界：清理 splat 接管并恢复 2.5D 画布可见
  if (window.__splatHandle) {
    disposeSplat(window.__splatHandle)
    window.__splatHandle = null
    if (scene) { scene._paused = false; scene.renderer.domElement.style.visibility = '' }
  }
  if (scene) { scene.dispose(); scene = null }
  showWorldCanvas(false)
  const ov = mountOverlay(`
    <div class="stage" id="stage-input">
      <div class="hero-bg${window.__heroLoaded ? ' loaded' : ''}" aria-hidden="true">
        <div class="hero-bg-img"></div>
      </div>
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
const CURATED_TEXT = ['想你', '晚安', '对不起', '自由的风', '一个人的海']
function startGenerate(text) {
  const recipe = buildRecipe(text)
  currentRecipe = recipe
  const cached = getCached(recipe.seed)
  // 调试/演示：?panourl= 显式指定全景 → 跳过生成，直接进世界页看全景背景
  const panoParam = params.get('panourl')
  if (panoParam && !recipe.panoUrl) {
    recipe.panoUrl = panoParam
    enterWorld(recipe, { instant: true })
    return
  }
  // 调试/演示：?spzurl= 显式指定 .spz 直链 → 跳过真生成，直接进世界渲染
  const spzParam = params.get('spzurl')
  if (spzParam && !recipe.spzUrl) {
    recipe.spzUrl = spzParam
    enterWorld(recipe, { instant: true })
    return
  }
  if (cached) {
    // 命中 → 秒开直进世界（主路径）
    if (cached.url) recipe.worldMarbleUrl = cached.url
    if (cached.spzUrl) recipe.spzUrl = cached.spzUrl
    if (cached.pano) recipe.panoUrl = cached.pano
    enterWorld(recipe, { instant: true })
  } else if (!CURATED_TEXT.includes(text.trim())) {
    // 非示例词 → 随机抽一个画廊世界（缩略图氛围背景 + 官方 3D 可跳转）
    const g = pickGalleryWorld(recipe.seed)
    recipe.panoUrl = g.img
    recipe.worldMarbleUrl = g.url
    recipe.palette = randomPalette(recipe.seed) // 2.5D 星球随机彩色
    setCached(recipe.seed, { prefilled: true, at: Date.now(), pano: g.img, url: g.url })
    enterWorld(recipe, { instant: true })
  } else if (marbleConfigured() && params.get('demo') !== '1') {
    // 示例词 + Marble 已配置 → 真生成（进度跟随轮询，约 5 分钟）
    enterGrowing(recipe, { real: true })
  } else {
    // 示例词 + Marble 未配置（或 ?demo=1 调试）→ 装饰生长动画（离线兜底）
    setCached(recipe.seed, { at: Date.now() })
    enterGrowing(recipe, { real: false })
  }
}

// 随机华丽调色板（由 seed 确定，同一词始终同色）
function randomPalette(seed) {
  const rng = rngFromSeed(seed)
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`
  const h1 = Math.floor(rng() * 360)
  const h2 = (h1 + 60 + Math.floor(rng() * 120)) % 360
  return {
    primary: hsl(h1, 80, 55),
    secondary: hsl(h2, 70, 25),
    glow: hsl(h1, 95, 70),
    particle: hsl(h2, 85, 65),
    label: '梦',
  }
}

// ---------- ② 生长 ----------
const GROW_STAGES = [
  '一念成形', '山川凝聚', '光在编织', '星辰归位', '你的世界，正在醒来',
]
function enterGrowing(recipe, { real = false } = {}) {
  genId++
  const myGen = genId
  showWorldCanvas(true)
  ensureScene()
  if (!scene) return goInput()
  window.__wsScene = scene // 调试钩子：暴露 scene 供验证（正式无碍）
  scene.setWorld(recipe)
  const ov = mountOverlay(`
    <div class="stage" id="stage-grow">
      <div class="grow-inner">
        <div class="grow-aura" aria-hidden="true">
          <canvas class="grow-particles"></canvas>
          <div class="grow-aura-core"></div>
        </div>
        <h2 class="grow-title">世界正在生长…</h2>
        <div class="grow-stage" id="growstage">${GROW_STAGES[0]}</div>
        <div class="grow-progress"><i id="growbar"></i></div>
        <div class="grow-pct" id="growpct">0%</div>
        <p class="grow-tip">山川正在成形，光正找到回家的路</p>
      </div>
    </div>
  `)
  const bar = ov.querySelector('#growbar')
  const stageEl = ov.querySelector('#growstage')
  const pctEl = ov.querySelector('#growpct')
  // 统一进度 UI：推进进度条 / 阶段文案轮播 / 百分比；到 100% 时停掉粒子
  let particlesStopped = false
  const stopParticles = () => {
    if (!particlesStopped && growParticles) { growParticles.stop(); particlesStopped = true }
  }
  const setProgress = p => {
    if (genId !== myGen) return
    const clamped = Math.max(0, Math.min(1, p))
    bar.style.width = (clamped * 100).toFixed(1) + '%'
    pctEl.textContent = Math.round(clamped * 100) + '%'
    const idx = Math.min(GROW_STAGES.length - 1, Math.floor(clamped * GROW_STAGES.length))
    stageEl.textContent = GROW_STAGES[idx]
    if (clamped >= 1) stopParticles()
  }
  // 星尘汇聚粒子：颜色取自世界情绪调色板，随生长推进
  const growCv = ov.querySelector('.grow-particles')
  const growParticles = growCv ? createGrowParticles(growCv, {
    colors: [recipe.palette.glow, recipe.palette.primary, '#ffffff'],
    count: 70,
  }) : null
  const dur = GROW_MS

  if (real) {
    // 真生成：进度跟随 Marble 轮询，动画持续到世界就绪
    scene.startGrowth(9999999, () => {}) // 无限生长仪式（不主动结束），由生成完成接管
    const startT = Date.now()
    ;(async () => {
      try {
        const operationId = await generateWorld(recipe.scenePrompt, { displayName: recipe.text.slice(0, 32) })
        const result = await pollOperation(operationId, {
          onProgress: d => {
            if (genId !== myGen) return
            // 用轮询时长平滑推进进度条（0-85%），剩余 15% 留给「世界就绪」过渡
            const p = Math.min(0.85, (Date.now() - startT) / (5 * 60 * 1000) * 0.85)
            setProgress(p)
          },
        })
        if (genId !== myGen) return
        // 完成：写入缓存（含 viewer URL + spz + pano）→ 世界页
        recipe.worldMarbleUrl = result.worldMarbleUrl
        recipe.spzUrls = result.spzUrls
        recipe.spzUrl = (result.spzUrls && (result.spzUrls['500k'] || result.spzUrls.full_res)) || ''
        recipe.panoUrl = result.panoUrl || ''
        setCached(recipe.seed, { at: Date.now(), url: result.worldMarbleUrl, spz: result.spzUrls, spzUrl: recipe.spzUrl, pano: recipe.panoUrl })
        setProgress(1)
        stageEl.textContent = '世界，长出来了'
        setTimeout(() => { if (genId === myGen) enterWorld(recipe) }, 600)
      } catch (e) {
        console.warn('[worldseed] Marble 生成失败，降级 2.5D：', e)
        if (genId === myGen) {
          setProgress(1)
          stageEl.textContent = '世界，长出来了'
          setTimeout(() => { if (genId === myGen) enterWorld(recipe) }, 400)
        }
      }
    })()
    return
  }

  scene.startGrowth(dur, p => {
    setProgress(p)
    if (p >= 1 && scene) {
      setTimeout(() => { if (genId === myGen) enterWorld(recipe) }, 380)
    }
  })
  // 完成兜底：rAF 被后台标签页冻结时 onProgress 永不触发，setTimeout 强制进世界页
  setTimeout(() => { if (genId === myGen && scene) enterWorld(recipe) }, dur + 1200)
}

// ---------- ③ 世界（漫游） ----------
function enterWorld(recipe, { instant = false } = {}) {
  genId++
  const myGen = genId
  showWorldCanvas(true)
  ensureScene()
  if (!scene) return goInput()
  window.__wsScene = scene // 调试钩子：暴露 scene 供验证（正式无碍）
  scene.setWorld(recipe)
  if (recipe.panoUrl) scene.setPano(recipe.panoUrl) // 真实世界全景背景（主路径，永远显示）
  if (instant) scene.startGrowth(900) // 秒开也有一段极短生长仪式（不阻塞，~0.9s）
  // 不再自动启用 Spark——用户机器可能跑不动，自动接管会导致黑屏
  // 改为：HUD 提供「真 3D 视图」按钮，点击才尝试，失败自动回全景
  const ov = mountOverlay(`
    <div class="world-hud">
      <div class="hud-left">
        <div class="hud-mood">${recipe.moodLabel} · ${recipe.form} · ${recipe.light}</div>
        <div class="hud-text">「${recipe.text}」</div>
      </div>
      <div class="hud-actions">
        ${recipe.spzUrl ? '<button id="btn3d" class="btn-ghost">真 3D 视图</button>' : ''}
        ${recipe.worldMarbleUrl ? '<button id="btnWorld" class="btn-ghost world-open">走进世界 ↗</button>' : ''}
        <button id="btnSeal" class="btn-ghost">封存成卡片</button>
        <button id="btnAgain" class="btn-ghost">换个念头</button>
      </div>
    </div>
  `)
  ov.querySelector('#btnSeal').addEventListener('click', () => goSeal(recipe))
  ov.querySelector('#btnAgain').addEventListener('click', goInput)
  const btnWorld = ov.querySelector('#btnWorld')
  if (btnWorld) btnWorld.addEventListener('click', () => window.open(recipe.worldMarbleUrl, '_blank'))
  const btn3d = ov.querySelector('#btn3d')
  if (btn3d) btn3d.addEventListener('click', () => tryEnableSplat(recipe)) // 手动触发真 3D，失败自动回全景
  if (myGen === genId) qualityWatchdog()
}

// splat 真 3D 接管：配方带 splatUrl/spzUrl 时尝试加载，成功则暂停 2.5D，失败保持 2.5D
async function tryEnableSplat(recipe) {
  if (window.__splatHandle) return // 已接管则不重复
  const params = new URLSearchParams(location.search)
  if (params.get('splat') === '1' && !recipe.ksplatUrl && !recipe.splatUrl && !recipe.spzUrl) {
    recipe.splatUrl = './worlds/test.splat'
  }
  if (params.get('spzurl') && !recipe.spzUrl) {
    recipe.spzUrl = params.get('spzurl')
  }
  if (!recipe.ksplatUrl && !recipe.splatUrl && !recipe.spzUrl) return
  const wc = document.getElementById('wc')
  if (!wc || !scene) return
  const handle = await tryLoadSplat(recipe, wc)
  if (!handle) { console.log('[worldseed] splat 不可用，保持全景/2.5D'); toast('真 3D 不可用，已保持全景视图'); return }
  window.__splatHandle = handle
  scene._paused = true
  scene.renderer.domElement.style.visibility = 'hidden'
  console.log('[worldseed] splat 真 3D 已接管')
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
  const canHover = window.matchMedia('(hover: hover)').matches
  window.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY
    if (canHover) {
      // hero 背景视差（轻微反向位移，仅桌面）
      const r = document.documentElement
      r.style.setProperty('--px', (((e.clientX / innerWidth) - 0.5) * -14).toFixed(1) + 'px')
      r.style.setProperty('--py', (((e.clientY / innerHeight) - 0.5) * -10).toFixed(1) + 'px')
    }
  }, { passive: true })
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
