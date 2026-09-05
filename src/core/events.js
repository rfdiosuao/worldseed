// 一念成界统一事件总线：世界状态机与白小纯表现层之间的窄腰协议。
const listeners = new Map()
const recent = []
export function emit(type, payload = {}) {
  const event = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, ts: Date.now(), payload }
  recent.push(event); if (recent.length > 200) recent.shift()
  for (const fn of listeners.get(type) || []) { try { fn(event) } catch (e) { console.warn('[worldseed:event]', type, e) } }
  return event
}
export function on(type, fn) { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); return () => set.delete(fn) }
export function recentEvents() { return recent.slice() }
