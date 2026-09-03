// marble.js —— World Labs Marble API 客户端（经 serverless 代理转发，前端不碰 key）
// P2 骨架：代理未部署时调用会优雅失败并提示；部署后填写代理地址即可启用真生成。
// 流程：generateWorld(prompt) → operation_id → pollOperation(id) → done 后返回 world_marble_url

const PROXY_BASE = import.meta.env.VITE_MARBLE_PROXY_URL || '' // 例如 https://your-worker.workers.dev

export function marbleConfigured() {
  return !!PROXY_BASE
}

// 发起世界生成；返回 operation_id
export async function generateWorld(textPrompt, { model = 'marble-1.1', displayName } = {}) {
  if (!marbleConfigured()) {
    throw new MarbleNotConfiguredError()
  }
  const res = await fetch(`${PROXY_BASE}/marble/v1/worlds:generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      display_name: displayName || textPrompt.slice(0, 32),
      model,
      world_prompt: { type: 'text', text_prompt: textPrompt },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new MarbleApiError(res.status, err.detail || res.statusText)
  }
  const data = await res.json()
  return data.operation_id
}

// 轮询 operation；done 后返回 { worldMarbleUrl, spzUrls, worldId, cost }
export async function pollOperation(operationId, { intervalMs = 6000, timeoutMs = 10 * 60 * 1000, onProgress } = {}) {
  if (!marbleConfigured()) throw new MarbleNotConfiguredError()
  const t0 = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - t0 > timeoutMs) throw new MarbleApiError(504, '生成超时（10 分钟）')
    const res = await fetch(`${PROXY_BASE}/marble/v1/operations/${operationId}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new MarbleApiError(res.status, err.detail || res.statusText)
    }
    const data = await res.json()
    onProgress && onProgress(data)
    if (data.done) {
      if (data.error) throw new MarbleApiError(500, data.error.message || '生成失败')
      const r = data.response || {}
      return {
        worldId: r.world_id,
        worldMarbleUrl: r.world_marble_url,
        spzUrls: (r.assets && r.assets.splats && r.assets.splats.spz_urls) || {},
        cost: data.cost,
      }
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

// 便捷：一步生成并等待完成（供 GROWING 阶段调用）
export async function generateWorldAndWait(prompt, opts = {}) {
  const operationId = await generateWorld(prompt, opts)
  return pollOperation(operationId, opts)
}

export class MarbleNotConfiguredError extends Error {
  constructor() {
    super('Marble 代理未配置：请在 .env 设置 VITE_MARBLE_PROXY_URL（或先启用离线兜底）')
    this.name = 'MarbleNotConfiguredError'
  }
}

export class MarbleApiError extends Error {
  constructor(status, detail) {
    super(`Marble API ${status}: ${detail}`)
    this.name = 'MarbleApiError'
    this.status = status
  }
}
