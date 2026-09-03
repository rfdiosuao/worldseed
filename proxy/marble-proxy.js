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
