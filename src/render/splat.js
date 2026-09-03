// splat.js —— .spz 真 3D 渲染（P1+ 接入 Marble）。P0 为空壳：无 .spz 或加载失败一律降级 2.5D。
export async function tryLoadSplat(recipe) {
  if (!recipe || !recipe.spzUrl) return null // P0 无 spz 资产，直接走 2.5D
  try {
    const mod = await import('gaussian-splats-3d') // 仅在确实需要时打包
    const viewer = new mod.Viewer({
      selfDrivenMode: true,
      renderMode: mod.RenderMode.ONLINE,
      antialiased: true,
      gpuAcceleratedSort: true,
    })
    await viewer.loadSplatScene(recipe.spzUrl, { sphericalHarmonics: true })
    return viewer
  } catch (e) {
    console.warn('[worldseed] splat 加载失败，降级 2.5D：', e)
    return null
  }
}
