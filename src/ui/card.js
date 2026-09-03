// card.js —— 封存卡片 + 二维码 + 零后端分享（URL hash）
import qrcodeFactory from 'qrcode-generator'
import { recipeToHash } from '../core/recipe.js'

const qrcode = qrcodeFactory.default || qrcodeFactory

// 生成分享 URL：对方打开同一静态页，读 #w= 即可重建同一世界（零后端）
export function buildShareUrl(recipe) {
  const base = location.origin + location.pathname
  return `${base}#w=${recipeToHash(recipe)}`
}

// 生成二维码 dataURL（白底，容错 M）
function makeQrDataUrl(text, cellSize = 4, margin = 2) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createDataURL(cellSize, margin)
}

// 构建封存卡片 DOM 并挂到容器
export function mountCard(container, recipe) {
  container.innerHTML = ''
  const url = buildShareUrl(recipe)
  const qrUrl = makeQrDataUrl(url, 4, 2)

  const card = document.createElement('div')
  card.className = 'seal-card'
  card.style.setProperty('--seal-primary', recipe.palette.primary)
  card.style.setProperty('--seal-glow', recipe.palette.glow)

  card.innerHTML = `
    <div class="seal-card-inner">
      <div class="seal-card-head">
        <span class="seal-mood">${recipe.moodLabel}</span>
        <span class="seal-id">#${recipe.seed.toString(16).slice(0, 6)}</span>
      </div>
      <div class="seal-card-body">
        <p class="seal-text">「${recipe.text}」</p>
        <p class="seal-form">${recipe.form} · ${recipe.light} · ${recipe.temp}</p>
      </div>
      <div class="seal-card-foot">
        <img class="seal-qr" src="${qrUrl}" alt="扫描进入这个世界" width="120" height="120" />
        <div class="seal-qr-hint">扫一扫 · 走进这个念头</div>
      </div>
    </div>
  `

  container.appendChild(card)
  return { url, card }
}
