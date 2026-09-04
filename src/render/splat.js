// splat.js —— 真 3D 高斯溅射渲染（@mkkellogg/gaussian-splats-3d@0.4.7）
// 支持 .spz（Marble 导出）/ .splat / .ply；失败自动降级 2.5D。
// 动态 import：不进主包，仅实际需要时才拉取（保主路径秒开）。

// 尝试加载 splat 场景；成功返回 { viewer, container }，失败返回 null（调用方降级 2.5D）
export async function tryLoadSplat(recipe, container) {
  const url = recipe.spzUrl || recipe.splatUrl || recipe.ksplatUrl
  if (!url) return null

  try {
    const { Viewer } = await import('@mkkellogg/gaussian-splats-3d') // 动态 import：分包加载
    const viewer = new Viewer({
      selfDrivenMode: true,          // 库自己驱动 rAF 渲染循环
      useBuiltInControls: true,      // 自带 OrbitControls（拖拽/缩放）
      rootElement: container,
      optimizeSplatData: false,      // 跳过数据优化，大幅加快 .spz 首载解析
      sphericalHarmonicsDegree: 0,   // 不解析球谐（无光照反射，加载更快）
    })

    // 0.4.7 API：addSplatScene 按后缀自动识别格式（.spz/.splat/.ply）
    await viewer.addSplatScene(url, {
      progressiveLoad: false,        // 关闭渐进加载（本地/直链更稳）
    })

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
