// splat.js —— 真 3D 高斯溅射渲染（gaussian-splats-3d）
// P1：支持 .ksplat/.splat/.ply/.spz（库支持范围），失败自动降级 2.5D。
import { Viewer } from 'gaussian-splats-3d'

// 尝试加载 splat 场景；成功返回 { viewer, container }，失败返回 null（调用方降级 2.5D）
export async function tryLoadSplat(recipe, container) {
  const url = recipe.ksplatUrl || recipe.splatUrl || recipe.spzUrl
  if (!url) return null

  try {
    const viewer = new Viewer({
      selfDrivenMode: true,          // 库自己驱动 rAF 渲染循环
      useBuiltInControls: true,      // 自带 OrbitControls（拖拽/缩放）
      rootElement: container,
    })

    await viewer.loadFile(url, {
      showLoadingSpinner: false,
    })

    return { viewer, container }
  } catch (e) {
    console.warn('[worldseed] splat 加载失败，降级 2.5D：', e)
    return null
  }
}

// 显式停止 viewer 的渲染循环并清理（切换到 2.5D / 离开世界时调用）
export function disposeSplat(handle) {
  if (!handle) return
  try {
    handle.viewer && handle.viewer.stop()
    if (handle.container) {
      // 移除 viewer 创建的 canvas（保留 2.5D 的 canvas）
      handle.container.querySelectorAll('canvas').forEach(c => {
        if (c !== handle._sceneCanvas) c.remove()
      })
    }
  } catch (e) { /* 清理失败静默 */ }
}
