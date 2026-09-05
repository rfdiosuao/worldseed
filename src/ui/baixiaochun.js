// 白小纯界灵：复用作品集原型的素材与交互，作为 Worldseed 的表现层适配器。
// 脱敏：不读取作品集个人信息，只消费世界配方与当前页面状态。
const IMG = n => `/baixiaochun/${n}.png`
const ACTIONS = {
  idle: ['idle', 'pet-idle'], nod: ['serious', 'pet-nod'], shake: ['think', 'pet-shake'],
  jump: ['jump', 'pet-jump'], cheer: ['jump', 'pet-cheer'], think: ['think', 'pet-think'],
  sit: ['sit', 'pet-sit'], panic: ['panic', 'pet-panic'], tickle: ['tsundere', 'pet-tickle'],
  bow: ['serious', 'pet-bow'], point: ['serious', 'pet-point'], fight: ['fight', 'pet-fight'],
  sword: ['sword', 'pet-dodge'], roam: ['walk1', 'pet-roam'],
}
const HEARTS = ['longing','tender','lonely','fervent','hopeful','melancholy','free','calm','solemn','ethereal']
const MOODS = ['tender','hopeful','proud','calm','panic','playful','solemn']
const HEART_MOOD = { longing:'tender', tender:'tender', lonely:'calm', fervent:'hopeful', hopeful:'hopeful', melancholy:'calm', free:'playful', calm:'calm', solemn:'solemn', ethereal:'calm' }
const HEART_HUE = { longing:265,tender:340,lonely:215,fervent:12,hopeful:140,melancholy:270,free:195,calm:170,solemn:235,ethereal:195 }
const DUR = { nod: 900, shake: 800, jump: 700, cheer: 900, think: 1100, sit: 1300, panic: 650, tickle: 800, bow: 1000, point: 900, fight: 900, sword: 700, roam: 4200 }
const LINES = {
  welcome: '道友，欢迎进入一念成界。本座替你守着这个刚长出来的小世界。',
  panic: ['哇哇！别碰我道袍！', '什么情况？本座还没准备好！', '道友轻点，差点把灵气吓散了！'],
  tickle: ['嘿嘿，被你发现了！', '道友有眼光，本座今天状态不错。', '别戳了，再戳就要显神通了！'],
  roam: ['本座去巡一圈，看看世界长得稳不稳。', '此界灵气充盈，甚好甚好。', '道友放心，本座替你看着。'],
}

let root, img, bubble, panel, messages, input, currentAction = 'idle'
let drag = null, roamTimer = null, roamBackTimer = null, chatBusy = false, suppressClick = false
const state = { xp: Number(localStorage.getItem('bxc_world_xp') || 0), turns: 0, lastWorld: null }

function say(text, mood = 'tender', speak = true) {
  if (!bubble) return
  bubble.textContent = text
  bubble.dataset.mood = mood
  if (speak && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.slice(0, 120)); u.lang = 'zh-CN'; u.rate = mood === 'panic' ? 1.12 : 1.05; u.pitch = mood === 'calm' ? 1.02 : 1.1
    speechSynthesis.speak(u)
  }
}
function applyMood(heart) { const h = HEARTS.includes(heart) ? heart : 'tender'; const hue = HEART_HUE[h]; document.documentElement.style.setProperty('--bxc-mood-hue', hue); document.documentElement.style.setProperty('--bxc-breathe', h === 'fervent' ? '1.6s' : h === 'ethereal' ? '5s' : '3s'); document.documentElement.style.setProperty('--bxc-float', h === 'panic' ? '2px' : h === 'ethereal' ? '12px' : '8px'); if (bubble) bubble.style.setProperty('--bxc-mood-color', `hsl(${hue} 65% 72%)`) }
function addXp(n = 1) { state.xp += n; localStorage.setItem('bxc_world_xp', String(state.xp)); renderRealm() }
function renderRealm() {
  const realm = state.xp >= 900 ? '结丹' : state.xp >= 300 ? '筑基' : state.xp >= 100 ? '炼气后期' : '炼气'
  const el = root?.querySelector('.bxc-realm'); if (el) el.textContent = realm
  const xp = root?.querySelector('.bxc-xp'); if (xp) xp.textContent = `修为 ${state.xp}`
}
function play(action, text) {
  if (!root || !img) return
  const key = ACTIONS[action] ? action : 'idle'; const [asset, cls] = ACTIONS[key]
  clearTimeout(play._timer); root.className = `bxc-pet ${cls}`; img.src = IMG(asset); currentAction = key
  if (text) say(text, key === 'panic' ? 'panic' : key === 'think' ? 'calm' : 'tender')
  play._timer = setTimeout(() => { if (key !== 'roam') { root.className = 'bxc-pet pet-idle'; img.src = IMG('3d'); currentAction = 'idle' } }, DUR[key] || 800)
}
function fallback(q) {
  if (/一念成界|生成世界|长出|创造/.test(q)) return { reply: '好！把你的念头说出来，本座替你开界。比如：我想回到下着雨的夏天。', action: 'cheer', mood: 'hopeful' }
  if (/累|熬夜|睡|休息/.test(q)) return { reply: '道友，你这是把自己当成不灭金身了吗？先让世界慢一点，也让自己喘口气。', action: 'sit', mood: 'tender' }
  if (/成功|完成|好了|谢谢/.test(q)) return { reply: '嘿嘿，本座早就看出道友有成界之姿！', action: 'cheer', mood: 'proud' }
  if (/世界|小世界|这里|怎么/.test(q)) return { reply: '这里是你的念头长成的世界。你说一句，它便有天气、颜色、地貌和一段只属于你的回响。', action: 'point', mood: 'calm' }
  return { reply: '唔……这个念头颇有玄机。道友再说具体些，本座才能替你看清它的灵根。', action: 'think', mood: 'calm' }
}
function addMessage(who, text) { if (!messages) return; const row = document.createElement('div'); row.className = `bxc-msg ${who}`; row.textContent = `${who === 'me' ? '道友' : '白小纯'}：${text}`; messages.appendChild(row); messages.scrollTop = messages.scrollHeight }
async function send(q) {
  q = q.trim(); if (!q || chatBusy) return
  addMessage('me', q); input.value = ''; state.turns++; localStorage.setItem('bxc_chat_count', String(state.turns));
  const endpoint = import.meta.env.VITE_BXC_AGENT_URL || ''; if (!endpoint && /^一念成界[，,：: ]+/.test(q)) { const seed = q.replace(/^一念成界[，,：: ]+/, '').trim(); if (seed) { say('收到！一念成界，开！', 'hopeful'); play('cheer'); window.__worldseedGenerate?.(seed); return } }
  if (q === '一念成界' || /怎么一念成界/.test(q)) { const r = fallback(q); addMessage('bot', r.reply); say(r.reply, r.mood); play(r.action); return }
  chatBusy = true; let result = null
  try {
    if (endpoint) { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat', message: q, context: worldContext(), history: [] }) }); if (res.ok) result = await res.json() }
  } catch (_) { /* 本地降级 */ }
  result = result?.reply ? result : fallback(q)
  const heart = HEARTS.includes(result.heart) ? result.heart : null
  const hasWorld = result.worldCommand && ['generate_world','noop'].includes(result.worldCommand.type)
  const mood = MOODS.includes(result.mood) && (!hasWorld || !heart) ? result.mood : (heart ? HEART_MOOD[heart] : 'tender')
  const action = ACTIONS[result.action] && (!hasWorld || !heart) ? result.action : (hasWorld ? 'cheer' : (heart ? 'think' : 'think'))
  if (heart) applyMood(heart)
  addMessage('bot', result.reply); say(result.reply, mood, result.speak !== false); play(action)
  if (Number(result.memory?.xpDelta) > 0) addXp(Math.min(3, Number(result.memory.xpDelta)))
  if (result.worldCommand?.type === 'generate_world' && result.worldCommand.seed) window.__worldseedGenerate?.(result.worldCommand.seed, { mood: heart || result.worldCommand.mood })
  chatBusy = false
}
function worldContext() { return { world: state.lastWorld?.text || '', mood: state.lastWorld?.moodLabel || '', action: currentAction, xp: state.xp, route: location.hash || '#input' } }
function openPanel() { panel.classList.add('open'); input?.focus(); if (!messages.children.length) { addMessage('bot', LINES.welcome); say(LINES.welcome, 'tender', false) } }
function closePanel() { panel.classList.remove('open') }
function roam() { if (panel.classList.contains('open') || currentAction !== 'idle') return; play('roam', LINES.roam[Math.floor(Math.random() * LINES.roam.length)]); addXp(1); clearTimeout(roamBackTimer); roamBackTimer = setTimeout(() => { root.style.transform = ''; play('idle') }, 4200) }
function scheduleRoam() { clearTimeout(roamTimer); roamTimer = setTimeout(() => { roam(); scheduleRoam() }, 25000 + Math.random() * 20000) }
function dragStart(e) { const p = e.touches?.[0] || e; drag = { x: p.clientX, y: p.clientY, ox: root.offsetLeft, oy: root.offsetTop, moved: false, dist: 0 }; root.classList.add('dragging'); img.src = IMG('fight'); e.preventDefault() }
function dragMove(e) { if (!drag) return; const p = e.touches?.[0] || e; const dx = p.clientX - drag.x, dy = p.clientY - drag.y; drag.dist = Math.abs(dx) + Math.abs(dy); if (drag.dist > 4) drag.moved = true; root.style.left = `${Math.max(8, Math.min(innerWidth - 150, drag.ox + dx))}px`; root.style.top = `${Math.max(8, Math.min(innerHeight - 190, drag.oy + dy))}px`; if (drag.dist > 150) { img.src = IMG('sword'); say('道友住手！再拽本座就要拔剑了！', 'panic'); root.classList.add('dodge') } }
function dragEnd() { if (!drag) return; const moved = drag.moved; localStorage.setItem('bxc_world_pet_pos', JSON.stringify({ left: root.style.left, top: root.style.top })); root.classList.remove('dragging', 'dodge'); img.src = IMG('3d'); drag = null; if (!moved) { play('tickle', LINES.tickle[Math.floor(Math.random() * LINES.tickle.length)]); addXp(1); openPanel() } else { suppressClick = true; setTimeout(() => { suppressClick = false }, 0) } }

export function initBaiXiaochun({ onGenerate } = {}) {
  window.__worldseedGenerate = onGenerate
  root = document.createElement('div'); root.id = 'bxcPet'; root.className = 'bxc-pet pet-idle'
  root.innerHTML = `<div class="bxc-bubble" id="bxcBubble">${LINES.welcome}</div><div class="bxc-card"><img id="bxcImg" src="${IMG('3d')}" alt="白小纯" draggable="false"><span class="bxc-realm">炼气</span><small class="bxc-xp">修为 0</small></div>`
  panel = document.createElement('div'); panel.id = 'bxcPanel'; panel.innerHTML = `<div class="bxc-panel-head"><b>问白小纯</b><button class="bxc-close">×</button></div><div class="bxc-messages"></div><div class="bxc-suggest"><button>一念成界</button><button>这个世界怎么样？</button><button>我有点累了</button></div><div class="bxc-input"><input placeholder="说一句话，或输入‘一念成界：…’"><button>发送</button></div>`
  document.body.append(root, panel); img = root.querySelector('#bxcImg'); bubble = root.querySelector('#bxcBubble'); messages = panel.querySelector('.bxc-messages'); input = panel.querySelector('input'); renderRealm()
  root.addEventListener('mouseenter', () => { if (!drag) play('panic', LINES.panic[Math.floor(Math.random() * LINES.panic.length)]) }); root.addEventListener('mousedown', dragStart); root.addEventListener('touchstart', dragStart, { passive: false });
  window.addEventListener('mousemove', dragMove); window.addEventListener('touchmove', dragMove, { passive: false }); window.addEventListener('mouseup', dragEnd); window.addEventListener('touchend', dragEnd)
  root.addEventListener('click', e => { if (!e.target.closest('button') && !drag && !suppressClick) openPanel() }); panel.querySelector('.bxc-close').onclick = closePanel; panel.querySelector('.bxc-input button').onclick = () => send(input.value); input.onkeydown = e => { if (e.key === 'Enter') send(input.value) }; panel.querySelectorAll('.bxc-suggest button').forEach(b => b.onclick = () => send(b.textContent)); document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel() });
  const saved = JSON.parse(localStorage.getItem('bxc_world_pet_pos') || 'null'); if (saved?.left) { root.style.left = saved.left; root.style.top = saved.top }
  scheduleRoam(); applyMood('tender'); window.__bxc = { play, say, addXp, applyMood, setWorld: r => { state.lastWorld = r; applyMood(r.mood); play('think', `此界已成。${r.moodLabel || '灵气'}正在流转。`) }, worldContext }
}


