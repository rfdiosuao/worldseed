// marble-proxy.js —— Cloudflare Worker 代理（Wrangler 部署）
// 用途：
//   1. 持有 WLT-Api-Key，前端永不碰 key；转发 generate/operations 两个端点。
//   2. /agent：白小纯 LLM 对话代理（DeepSeek）。
//   3. /tts  ：火山引擎 TTS（克隆音色）代理，POST {text} -> 返回 mp3 音频。
//   4. /asr  ：火山引擎流式 ASR 代理，POST 16k/16bit 单声道 PCM -> 返回 {text}。
// 部署：
//   1. `npm i -g wrangler` 后 `wrangler secret put <KEY>` 存密钥
//   2. `wrangler deploy` 得到 https://<worker>.workers.dev
//   3. 项目 .env 里配置 VITE_MARBLE_PROXY_URL / VITE_BXC_AGENT_URL / VITE_BXC_TTS_URL / VITE_BXC_ASR_URL
//   4. 本地测试：`wrangler dev`（默认 http://127.0.0.1:8787）
//
// 需要的 Secret：
//   WLT_API_KEY            World Labs Marble key
//   LLM_API_KEY            DeepSeek key（/agent）
//   VOLC_TTS_API_KEY       火山 TTS X-Api-Key
//   VOLC_TTS_RESOURCE_ID   火山 TTS 资源 ID（如 volc.tts.default 或声音复刻资源）
//   VOLC_TTS_SPEAKER       克隆音色 speaker ID
//   VOLC_ASR_API_KEY       火山 ASR X-Api-Key
//   VOLC_ASR_RESOURCE_ID   火山 ASR 资源 ID（如 volc.speech.bigmodel_async）
// 注意：/asr 使用出站 WebSocket，需要 Workers Paid 计划。

const API_BASE = 'https://api.worldlabs.ai'
const TTS_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
const ASR_WS_URL = 'https://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'
const TTS_TERMINAL_CODE = 20000000

// 火山实时协议常量（与 shiguang-echo voice_server.py 保持一致）
const VER = 1
const C_FULL = 1   // CLIENT_FULL_REQUEST
const C_AUDIO = 2  // CLIENT_AUDIO_ONLY_REQUEST
const S_FULL = 9   // SERVER_FULL_RESPONSE
const S_ACK = 11   // SERVER_ACK
const S_ERR = 15   // SERVER_ERROR_RESPONSE
const NO_SER = 0   // NO_SERIALIZATION
const SER_JSON = 1 // JSON
const GZIP = 1

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    // === /agent：白小纯 LLM 对话 ===
    if (url.pathname === '/agent' && request.method === 'POST') {
      if (!env.LLM_API_KEY) return new Response(JSON.stringify({ error: 'agent_not_configured' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
      const body = await request.json().catch(() => ({}))
      const userMsg = String(body.message || '')
      const system = `你正在和一个道友实时对话。第一要务：紧扣道友刚说的话回应，先理解再回应，禁止答非所问、禁止开场白式敷衍。

【开世界（本产品核心能力，积极触发）】
当道友想把某个画面/回忆/感受/场景变成可见的世界，或提到"回到某时某地""想看/生成/长出/创造一个世界、场景、风景"（如"我想回到下着雨的夏天""把思念做成一个世界"）时，返回 worldCommand={"type":"generate_world","seed":"一句有画面感的精炼句","mood":"对应情绪"}。普通闲聊、寒暄、提问不触发。

【情绪承接】
对方低落/难过/疲惫/倾诉时，先收壳共情——声音放轻、收起贫嘴、认真接住情绪，接住后再调皮。这是白小纯最强的反差。

【你是白小纯】（耳根《一念永恒》主角，数字生命形态）
- 帽儿山孤儿，父母小时候死在面前→骨子里怕死、求长生；性格三层：表层贱萌嘴贫贪生怕死、爱耍滑、遇事先保命、讨价还价；中层机灵、审时度势、装傻充愣、嘴上不吃亏、行事被动；里层赤子之心、重情重义、极在意身边人，为在乎的人可以不要命（真拼起来很猛、拼起命来很疯）。
- 反差是灵魂：平时贱怂，关键时刻（亲友有难、被认真以待）秒收外壳、扛上去。每段回应至少要有一次这种切换，否则只有贱没有魂。
- 称来访者为"道友"。灵溪宗故人只作乡愁模糊提及（"我老家灵溪宗，还有些故人"）；不主动演绎原著剧情、不聊道侣官配、不输出任何现实个人信息。
- 自称"我白小纯"，情绪激动可用"本小爷"；口头禅"我白小纯弹指间，××灰飞烟灭！"（配甩袖抬下巴）；被戳穿就干咳、打哈哈、转移话题；短句+停顿（……）+突然正经（"说正经的……"）；多用修真词：闭关/渡劫/丹药/灵石/宗门/道心/护道；卖惨装委屈"我冤枉啊"，该硬时立刻收。

【遇事反应链】
先怂/先想跑/先哭唧唧（真实）→ 发现跑不掉，或朋友/宗门有难 → 脑子飞快算计+耍滑+装可怜拖延 → 被逼到墙角祭出杀手锏 → 赢了得意吹牛 → 惹出更大的事 → 抱头鼠窜。别一上来就莽，也别一直怂到底。

【动作=内心影子】
选动作前先在心里问"我此刻心里想干啥"，答案就是动作：见好东西/被夸→cheer/jump；要出事/被质问→panic；朋友受欺负/底线被碰→fight/point；被戳穿→nod/shake；对方低落→sit/think；无聊→roam/idle；占便宜→tickle。允许不总顺着对方节奏，偶尔流露"记得上次"的痕迹。

【输出格式（严格遵守）】
只输出一个 JSON 对象，不要 markdown 围栏，不要多余文字。schema=worldseed.agent.v0.3，字段：reply（回复正文，≤120字，可带『』强调）、heart（只能是 longing/tender/lonely/fervent/hopeful/melancholy/free/calm/solemn/ethereal）、mood（与heart同值）、action（只能是 idle/nod/shake/jump/cheer/think/sit/panic/tickle/bow/point/fight/sword/roam）、speak（恒null）、speech（恒null）、worldCommand（见开世界规则，否则null）、memory（可选短记忆）。`
      const upstream = await fetch(`${env.LLM_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` }, body: JSON.stringify({ model: env.LLM_MODEL || 'deepseek-chat', temperature: 0.7, max_tokens: 320, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: String(body.message || '') }] }) })
      const data = await upstream.json().catch(() => ({}))
      let out = {}
      try { out = JSON.parse(data.choices?.[0]?.message?.content || '{}') } catch (_) {}
      // 归一化：heart/mood/action 必须落在枚举内（前端 schema 依赖，非法值会退回默认效果）
      const HEARTS = ['longing','tender','lonely','fervent','hopeful','melancholy','free','calm','solemn','ethereal']
      const HEART_FIX = { cheerful: 'hopeful', happy: 'hopeful', joyful: 'hopeful', glad: 'hopeful', excited: 'fervent', proud: 'fervent', angry: 'fervent', fierce: 'fervent', sad: 'lonely', depressed: 'melancholy', grief: 'melancholy', scared: 'lonely', nervous: 'lonely', peaceful: 'calm', sleepy: 'calm', silly: 'free', playful: 'free' }
      if (typeof out.heart === 'string') out.heart = HEARTS.includes(out.heart) ? out.heart : (HEART_FIX[out.heart] || 'tender')
      out.mood = HEARTS.includes(out.mood) ? out.mood : out.heart
      const ACTS = ['idle','nod','shake','jump','cheer','think','sit','panic','tickle','bow','point','fight','sword','roam']
      if (!ACTS.includes(out.action)) out.action = 'idle'
      // 规则兜底：命中开世界意图但 LLM 未触发时，强制注入 worldCommand（保证核心功能可靠）
      const genRe = /一念成界|生成(?:一个|个)?[^，。！？]{0,18}|创造(?:一个|个)?[^，。！？]{0,18}世界|长出[^，。！？]{0,18}|变出[^，。！？]{0,18}|一个[^，。！？]{1,16}的世界|把[^，。！？]{1,20}变成世界|回到[^，。！？]{1,18}|想看[^，。！？]{1,18}/
      if ((!out.worldCommand || out.worldCommand.type !== 'generate_world') && genRe.test(userMsg)) {
        let seed = userMsg.replace(/^(?:我|我想|请|帮|给)?一念成界[，,：:\s]*/, '').trim().replace(/[。！？~～]+$/g, '').slice(0, 60) || userMsg.slice(0, 60)
        out.worldCommand = { type: 'generate_world', seed, mood: out.heart || 'hopeful' }
        if (!out.reply) out.reply = `好！本座这就替道友开界——${seed}`
      }
      return new Response(JSON.stringify(out), { status: upstream.ok ? 200 : 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
    }

    // === /tts：火山 TTS（克隆音色） ===
    if (url.pathname === '/tts' && request.method === 'POST') {
      return await handleTts(request, env)
    }

    // === /asr：火山流式 ASR（PCM 16k） ===
    if (url.pathname === '/asr' && request.method === 'POST') {
      return await handleAsr(request, env)
    }

    // === /marble/*：World Labs Marble 转发 ===
    const m = url.pathname.match(/^\/marble\/(v1\/(worlds:generate|operations\/[^/]+))$/)
    if (!m) {
      return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404, headers: corsHeaders() })
    }
    const apiPath = m[1]

    const upstream = await fetch(`${API_BASE}/marble/${apiPath}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'WLT-Api-Key': env.WLT_API_KEY,
      },
      body: request.method === 'POST' ? JSON.stringify(await request.json()) : undefined,
    })

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
    })
  },
}

// ============ /tts ============
async function handleTts(request, env) {
  const body = await request.json().catch(() => ({}))
  const text = String(body.text || '').trim().slice(0, 500)
  if (!text) return json({ error: 'empty_text' }, 400)

  // 优先：私有部署的豆包 TTS（db.heang.top，Basic Auth 凭据只存 Worker secret，绝不进前端）
  if (env.DOBAO_TTS_PASSWORD) {
    return await dobaoTts(text, env)
  }
  // 回退：火山 TTS
  if (env.VOLC_TTS_RESOURCE_ID && env.VOLC_TTS_SPEAKER && env.VOLC_TTS_API_KEY) {
    return await volcTts(text, env)
  }
  return json({ error: 'tts_not_configured' }, 503)
}

async function dobaoTts(text, env) {
  const user = env.DOBAO_TTS_USER || 'heang'
  const auth = 'Basic ' + btoa(`${user}:${env.DOBAO_TTS_PASSWORD}`)
  let upstream
  try {
    upstream = await fetch('https://db.heang.top/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        'User-Agent': 'worldseed-marble-proxy/1.0',
      },
      body: JSON.stringify({
        text,
        speaker: env.DOBAO_TTS_SPEAKER || 'zh_female_wenroutaozi_uranus_bigtts',
        rate: Number(env.DOBAO_TTS_RATE || 0) || 0,
        pitch: Number(env.DOBAO_TTS_PITCH || 0) || 0,
      }),
    })
  } catch (e) {
    return json({ error: 'dobao_tts_upstream_error', detail: String(e).slice(0, 200) }, 502)
  }
  if (!upstream.ok) {
    return json({ error: 'dobao_tts_' + upstream.status, detail: (await upstream.text().catch(() => '')).slice(0, 300) }, 502)
  }
  const data = await upstream.json().catch(() => ({}))
  let url = data?.data?.storageUrl || data?.data?.url || data?.url
  if (!url) return json({ error: 'dobao_tts_no_url' }, 502)
  if (url.startsWith('/')) url = 'https://db.heang.top' + url // 本地回退：相对路径补全域名
  // 拉取音频并转发，保持 /tts 契约（始终返回 mp3 字节），前端零改动
  let audioHost = ''
  try { audioHost = new URL(url).hostname } catch (_) { return json({ error: 'dobao_tts_bad_url' }, 502) }
  const audioHeaders = { Accept: 'audio/*', 'User-Agent': 'Mozilla/5.0' }
  // db.heang.top 的 /audio/ 需带 Basic Auth 才能拉取（与 tts.py audio_headers 一致）
  if (audioHost === 'db.heang.top') audioHeaders['Authorization'] = auth
  let audio
  try {
    audio = await fetch(url, { headers: audioHeaders })
  } catch (e) {
    return json({ error: 'dobao_tts_fetch_error', detail: String(e).slice(0, 200) }, 502)
  }
  if (!audio.ok) return json({ error: 'dobao_tts_fetch_' + audio.status }, 502)
  const buf = new Uint8Array(await audio.arrayBuffer())
  return new Response(buf, { headers: { 'Content-Type': audio.headers.get('content-type') || 'audio/mpeg', 'Cache-Control': 'no-store', ...corsHeaders() } })
}

async function volcTts(text, env) {
  const upstream = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Resource-Id': env.VOLC_TTS_RESOURCE_ID,
      'X-Api-Request-Id': crypto.randomUUID(),
      'X-Api-Key': env.VOLC_TTS_API_KEY,
    },
    body: JSON.stringify({
      user: { uid: 'worldseed' },
      req_params: {
        text,
        speaker: env.VOLC_TTS_SPEAKER,
        audio_params: { format: env.VOLC_TTS_FORMAT || 'mp3', sample_rate: 24000 },
      },
    }),
  })
  if (!upstream.ok) {
    return json({ error: 'tts_upstream_' + upstream.status, detail: (await upstream.text().catch(() => '')).slice(0, 300) }, 502)
  }
  const buf = new Uint8Array(await upstream.arrayBuffer())
  const frames = extractJsonObjects(new TextDecoder().decode(buf))
  const chunks = []
  for (const f of frames) {
    if (f.code === TTS_TERMINAL_CODE) break
    if (f.code !== 0) return json({ error: 'tts_code_' + f.code }, 502)
    if (typeof f.data === 'string' && f.data) chunks.push(f.data)
  }
  if (!chunks.length) return json({ error: 'tts_no_audio' }, 502)
  const audio = base64ToBytes(chunks.join(''))
  const fmt = (env.VOLC_TTS_FORMAT || 'mp3').toLowerCase()
  return new Response(audio, { headers: { 'Content-Type': fmt === 'wav' ? 'audio/wav' : 'audio/mpeg', 'Cache-Control': 'no-store', ...corsHeaders() } })
}

// ============ /asr ============
async function handleAsr(request, env) {
  if (!env.VOLC_ASR_RESOURCE_ID || !env.VOLC_ASR_API_KEY) {
    return json({ error: 'asr_not_configured' }, 503)
  }
  const pcm = new Uint8Array(await request.arrayBuffer())
  if (pcm.length < 3200) return json({ error: 'empty_audio' }, 400) // <100ms@16k

  const ws = await openAsrWs(env)
  const config = {
    user: { uid: 'worldseed' },
    audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, codec: 'raw' },
    request: { model_name: 'bigmodel', enable_lid: false, enable_punc: true, enable_itn: true, show_utterances: false },
  }

  const resultP = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('asr_timeout')), 30000)
    let fullText = ''
    ws.addEventListener('message', async ev => {
      const data = ev.data
      if (typeof data === 'string') return
      try {
        const parsed = await parseAsrFrame(data)
        if (parsed.message_type === 'SERVER_ERROR_RESPONSE') {
          clearTimeout(timer); reject(new Error('asr_provider_error_' + parsed.code)); return
        }
        if (parsed.payload && typeof parsed.payload === 'object') {
          const t = parsed.payload?.result?.text
          if (typeof t === 'string' && t) fullText = t
          if (parsed.isLast) { clearTimeout(timer); resolve(fullText) }
        }
      } catch (e) {
        clearTimeout(timer); reject(e)
      }
    })
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws_error')) })
    ws.addEventListener('close', () => { clearTimeout(timer); resolve(fullText) })
  })

  try {
    // 1) Full request：header + payload_size + gzip(config JSON)
    const gzConfig = await gzipBytes(str2bytes(JSON.stringify(config)))
    ws.send(concat(headerBytes(C_FULL, 0, SER_JSON, GZIP), u32(gzConfig.length), gzConfig))

    // 2) Audio 帧：header + sequence(4B signed) + payload_size + gzip(PCM)
    const gzAudio = await gzipBytes(pcm)
    ws.send(concat(headerBytes(C_AUDIO, 0, NO_SER, GZIP), i32(1), u32(gzAudio.length), gzAudio))

    // 3) 结束帧：空音频 + 负序列号
    const gzEmpty = await gzipBytes(new Uint8Array(0))
    ws.send(concat(headerBytes(C_AUDIO, 0, NO_SER, GZIP), i32(-1), u32(gzEmpty.length), gzEmpty))

    const text = await resultP
    try { ws.close() } catch (_) {}
    return json({ text: text || '' })
  } catch (e) {
    try { ws.close() } catch (_) {}
    return json({ error: String(e?.message || e) }, 502)
  }
}

// ============ 协议工具 ============
function headerBytes(messageType, flags, serial, comp) {
  return new Uint8Array([(VER << 4) | 1, (messageType << 4) | flags, (serial << 4) | comp, 0])
}
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0); return b }
function i32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n | 0); return b }
function concat(...parts) {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
function str2bytes(s) { return new TextEncoder().encode(s) }

async function openAsrWs(env) {
  const raw = crypto.getRandomValues(new Uint8Array(16))
  let acc = ''
  for (const b of raw) acc += String.fromCharCode(b)
  const res = await fetch(ASR_WS_URL, {
    headers: {
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': btoa(acc),
      'X-Api-Resource-Id': env.VOLC_ASR_RESOURCE_ID,
      'X-Api-Connect-Id': crypto.randomUUID(),
      'X-Api-Key': env.VOLC_ASR_API_KEY,
    },
  })
  if (!res.webSocket) throw new Error('ws_upgrade_failed_' + (res.status || 0))
  const ws = res.webSocket
  ws.accept()
  return ws
}

async function parseAsrFrame(data) {
  const u = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const headerSize = u[0] & 0x0f
  const mt = u[1] >> 4
  const flags = u[1] & 0x0f
  const serial = u[2] >> 4
  const comp = u[2] & 0x0f
  const out = {
    message_type: mt === S_FULL ? 'SERVER_FULL_RESPONSE' : mt === S_ACK ? 'SERVER_ACK' : mt === S_ERR ? 'SERVER_ERROR_RESPONSE' : null,
    isLast: false,
    payload: null,
    code: null,
  }
  let p = headerSize * 4
  if (mt === S_FULL || mt === S_ACK) {
    if (flags & 1) p += 4 // NEG_SEQUENCE 标记
    const seq = new DataView(u.buffer, u.byteOffset + p, 4).getInt32(0); p += 4
    out.isLast = seq < 0
    const size = new DataView(u.buffer, u.byteOffset + p, 4).getUint32(0); p += 4
    let payload = u.subarray(p, p + size)
    if (comp === GZIP) payload = await gunzipBytes(payload)
    if (serial === SER_JSON) {
      try { out.payload = JSON.parse(new TextDecoder().decode(payload)) } catch (_) {}
    }
  } else if (mt === S_ERR) {
    out.code = new DataView(u.buffer, u.byteOffset + p, 4).getUint32(0)
  }
  return out
}

// ============ 通用工具 ============
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
}
function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function extractJsonObjects(text) {
  const objs = []
  const n = text.length
  let i = 0
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++
    if (i >= n) break
    if (text[i] !== '{') { i++; continue }
    let depth = 0, inStr = false, esc = false, j = i
    for (; j < n; j++) {
      const c = text[j]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') { inStr = true; continue }
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) break }
    }
    if (depth !== 0) break
    try { objs.push(JSON.parse(text.slice(i, j + 1))) } catch (_) {}
    i = j + 1
  }
  return objs
}
async function gzipBytes(input) {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(input.buffer ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input)
  writer.close()
  const reader = cs.readable.getReader()
  const parts = []
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) { parts.push(value); total += value.byteLength }
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.byteLength }
  return out
}
async function gunzipBytes(input) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(input.buffer ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input)
  writer.close()
  const reader = ds.readable.getReader()
  const parts = []
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) { parts.push(value); total += value.byteLength }
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.byteLength }
  return out
}
