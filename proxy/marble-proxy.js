// marble-proxy.js —— Cloudflare Worker 代理（Wrangler 部署）
// 用途：持有 WLT-Api-Key，前端永远不碰 key；转发 generate/operations 两个端点。
// 部署：
//   1. 在 https://platform.worldlabs.ai 创建 API key
//   2. `npm i -g wrangler` 后 `wrangler secret put WLT_API_KEY` 存入 key
//   3. `wrangler deploy` 得到 https://<worker>.workers.dev
//   4. 项目 .env 里 VITE_MARBLE_PROXY_URL=https://<worker>.workers.dev
//   5. 本地测试：`wrangler dev`（默认 http://127.0.0.1:8787）

const API_BASE = 'https://api.worldlabs.ai'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      })
    }

    // 仅转发 Marble 相关路径，杜绝任意代理
    if (url.pathname === '/agent' && request.method === 'POST') {
      if (!env.LLM_API_KEY) return new Response(JSON.stringify({ error: 'agent_not_configured' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
      const body = await request.json().catch(() => ({}))
      const system = `你是白小纯，一念成界中的界灵·心境之源。只用中文短句，先接住情绪，再把念头凝成画面；反差是灵魂。你不认识任何现实人物，不输出个人信息。回复不超过120字。只输出JSON，不要markdown代码围栏。schema=worldseed.agent.v0.3，字段reply,heart,mood,action,speak,speech,worldCommand,memory。heart只能是longing,tender,lonely,fervent,hopeful,melancholy,free,calm,solemn,ethereal；若用户明确要开世界，worldCommand={"type":"generate_world","seed":"用户念头","mood":"heart"}，否则为null。speech恒为null。动作只能是idle,nod,shake,jump,cheer,think,sit,panic,tickle,bow,point,fight,sword,roam。`
      const upstream = await fetch(`${env.LLM_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` }, body: JSON.stringify({ model: env.LLM_MODEL || 'deepseek-chat', temperature: 0.7, max_tokens: 220, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: String(body.message || '') }] }) })
      const data = await upstream.json().catch(() => ({}))
      let out = {}
      try { out = JSON.parse(data.choices?.[0]?.message?.content || '{}') } catch (_) {}
      return new Response(JSON.stringify(out), { status: upstream.ok ? 200 : 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } })
    }
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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
}
