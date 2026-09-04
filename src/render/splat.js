// splat.js —— 真 3D 高斯溅射渲染（@mkkellogg/gaussian-splats-3d@0.4.7）
// 快路径（B轨提速）：.spz → SpzLoader(no-opt 解析 ~2s) → addSplatBuffers(GPU排序+先渲染)
// 慢路径（回退）：.splat/.ply → addSplatScene（本地测试资产）
// 失败自动降级 2.5D。动态 import：不进主包。

// 尝试加载 splat 场景；成功返回 { viewer, container }，失败返回 null（调用方降级 2.5D）
export async function tryLoadSplat(recipe, container) {
  const url = recipe.spzUrl || recipe.splatUrl || recipe.ksplatUrl
  if (!url) return null

  try {
    const GS = await import('@mkkellogg/gaussian-splats-3d') // 动态 import：分包加载

    const viewer = new GS.Viewer({
      selfDrivenMode: true,          // 库自己驱动 rAF 渲染循环
      useBuiltInControls: true,      // 自带 OrbitControls（拖拽/缩放）
      rootElement: container,
      optimizeSplatData: false,      // 关键：跳过慢优化管线（否则 .spz 解析 >60s）
      sphericalHarmonicsDegree: 0,   // 不解析球谐（无光照反射，更快）
      gpuAcceleratedSort: true,      // GPU 排序，跳过 CPU sort worker（卡点）
    })

    if (url.endsWith('.spz')) {
      // 快路径：库权威解析（~2s）→ 直接喂 buffer → 先渲染后排序
      const splatBuffer = await GS.SpzLoader.loadFromURL(url, () => {}, 1, 0, false, 0)
      await viewer.addSplatBuffers([splatBuffer], [{}], true, false, false, false, true)
    } else {
      // 慢路径（.splat/.ply）：库内置加载
      await viewer.addSplatScene(url, { progressiveLoad: false, showLoadingUI: false })
    }

    return { viewer, container }
  } catch (e) {
    console.warn('[worldseed] splat 加载失败，降级 2.5D：', e)
    return null
  }
}

// 显式停止 viewer 并清理（切换到 2.5D / 离开世界时调用）
export function disposeSplat(handle) {
  if (!handle) return
  try {
    if (handle.viewer && typeof handle.viewer.dispose === 'function') {
      handle.viewer.dispose() // 0.4.7 完整释放
    } else if (handle.viewer && typeof handle.viewer.stop === 'function') {
      handle.viewer.stop()
    }
    if (handle.container) {
      // 移除 viewer 创建的 canvas（保留 2.5D 的 canvas）
      handle.container.querySelectorAll('canvas').forEach(c => c.remove())
    }
  } catch (e) { /* 清理失败静默 */ }
}
