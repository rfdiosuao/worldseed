// splat.js —— 真 3D 高斯溅射渲染（World Labs 官方 @sparkjsdev/spark@2.1.0）
// 严格按官方示例 worldlabsai/worldlabs-api-examples/web-generate-world 的结构：
//   THREE.WebGLRenderer + SparkRenderer({renderer, view:{sort32:true}}) → scene.add(spark)
//   SplatLoader.loadAsync(spz) → SplatMesh → scene.add(world) → SparkControls → setAnimationLoop
// 原生支持 Marble .spz；失败自动降级 2.5D/全景。动态 import：不进主包。

export async function tryLoadSplat(recipe, container) {
  const url = recipe.spzUrl || recipe.splatUrl
  if (!url) return null

  try {
    const THREE = await import('three')
    const { SparkRenderer, SplatMesh, SplatLoader, SparkControls } = await import('@sparkjsdev/spark')

    // ① 场景 / 相机（官方：camera 加入 scene，相机在原点，世界旋转）
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.01, 1000)
    scene.add(camera)

    // ② WebGL 渲染器 + Spark 扩展（官方：SparkRenderer 接收已有 renderer，且要 add 进 scene）
    const canvas = document.createElement('canvas')
    container.appendChild(canvas)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    const spark = new SparkRenderer({ renderer, view: { sort32: true } })
    scene.add(spark)

    // ③ 加载 .spz（官方 SplatLoader 原生支持 Marble SPZ）
    const loader = new SplatLoader()
    const packedSplats = await loader.loadAsync(url, () => {})

    // ④ 世界网格（官方：quaternion 180° X 旋转做 three.js 轴转换）
    const world = new SplatMesh({ packedSplats })
    world.quaternion.set(1, 0, 0, 0)
    scene.add(world)

    // ⑤ 相机初始在原点，看向世界（官方）
    camera.position.set(0, 0, 0)
    camera.quaternion.set(0, 0, 0, 1)

    // ⑥ 控制 + 动画循环
    const controls = new SparkControls({ canvas })
    renderer.setAnimationLoop(() => {
      controls.update(camera)
      renderer.render(scene, camera)
    })

    return { spark, world, scene, camera, renderer, controls, canvas, container }
  } catch (e) {
    console.warn('[worldseed] splat(spark) 加载失败，降级 2.5D：', e)
    return null
  }
}

export function disposeSplat(handle) {
  if (!handle) return
  try {
    const { renderer, controls, world, canvas } = handle
    if (renderer && typeof renderer.setAnimationLoop === 'function') renderer.setAnimationLoop(null)
    if (controls && typeof controls.dispose === 'function') controls.dispose()
    if (world && typeof world.dispose === 'function') world.dispose()
    if (renderer && typeof renderer.dispose === 'function') renderer.dispose()
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas)
  } catch (e) { /* 清理失败静默 */ }
}
