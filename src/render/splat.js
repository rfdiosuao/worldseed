// splat.js —— 真 3D 高斯溅射渲染（World Labs 官方 @sparkjsdev/spark@2.1.0）
// 三层守卫，保证永不黑屏：
// ① probeSpark：渲染器能出帧（含内容）
// ② 加载超时 12s
// ③ SplatMesh 首帧像素检查：真黑屏则回退全景/2.5D

let sparkOk = null

export async function probeSpark() {
  if (sparkOk !== null) return sparkOk
  try {
    const THREE = await import('three')
    const { SparkRenderer } = await import('@sparkjsdev/spark')
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const renderer = new THREE.WebGLRenderer({ canvas })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 0, 2)
    const spark = new SparkRenderer({ renderer, view: { sort32: true } })
    scene.add(spark)
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({ color: 0xff0000 })))
    renderer.render(scene, camera)
    const px = new Uint8Array(128*128*4)
    renderer.getContext().readPixels(0, 0, 128, 128, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, px)
    let lit = 0
    for (let i = 0; i < px.length; i += 4) if (px[i] > 10 || px[i+1] > 10 || px[i+2] > 10) lit++
    const ratio = lit / (128*128)
    console.log(`[worldseed] Spark 探针: 非黑像素比 ${(ratio*100).toFixed(1)}%`)
    renderer.dispose(); canvas.remove()
    sparkOk = ratio > 0.02
    return sparkOk
  } catch (e) { console.warn('[worldseed] Spark 探针异常:', e); sparkOk = false; return false }
}

export async function tryLoadSplat(recipe, container) {
  if (!(await probeSpark())) return null
  const url = recipe.spzUrl || recipe.splatUrl
  if (!url) return null

  const timeoutMs = 12000
  let timer
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs) })

  const load = (async () => {
    try {
      const THREE = await import('three')
      const { SparkRenderer, SplatMesh, SplatLoader, SparkControls } = await import('@sparkjsdev/spark')

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.01, 1000)
      scene.add(camera)
      const canvas = document.createElement('canvas')
      container.appendChild(canvas)
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(container.clientWidth, container.clientHeight)
      const spark = new SparkRenderer({ renderer, view: { sort32: true } })
      scene.add(spark)

      const loader = new SplatLoader()
      const packedSplats = await loader.loadAsync(url, () => {})
      const world = new SplatMesh({ packedSplats })
      world.quaternion.set(1, 0, 0, 0)
      scene.add(world)
      camera.position.set(0, 0, 0)
      camera.quaternion.set(0, 0, 0, 1)
      const controls = new SparkControls({ canvas })
      renderer.setAnimationLoop(() => { controls.update(camera); renderer.render(scene, camera) })

      // 守卫③：渲染 2 帧后读像素，全黑则判定黑屏 → 回退
      await new Promise(r => setTimeout(r, 500))
      renderer.render(scene, camera)
      const gl = renderer.getContext()
      const w = Math.min(gl.drawingBufferWidth, 200), h = Math.min(gl.drawingBufferHeight, 200)
      const px = new Uint8Array(w*h*4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
      let lit = 0
      for (let i = 0; i < px.length; i += 4) if (px[i] > 10 || px[i+1] > 10 || px[i+2] > 10) lit++
      const ratio = lit / (w*h)
      console.log(`[worldseed] SplatMesh 首帧检查: 非黑像素比 ${(ratio*100).toFixed(1)}%`)
      if (ratio < 0.001) { // 几乎全黑 → SplatMesh 没画出来
        console.warn('[worldseed] SplatMesh 黑屏，回退全景/2.5D')
        renderer.setAnimationLoop(null)
        renderer.dispose()
        canvas.remove()
        return null
      }

      return { spark, world, scene, camera, renderer, controls, canvas, container }
    } catch (e) {
      console.warn('[worldseed] splat(spark) 加载失败，回退全景/2.5D：', e)
      return null
    }
  })()

  const result = await Promise.race([load, timeout])
  clearTimeout(timer)
  return result
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
  } catch (e) {}
}
