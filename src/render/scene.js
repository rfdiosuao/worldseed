// scene.js —— 2.5D 世界渲染器（three.js）
// GROWING 与 WORLD 共用同一场景图：生长 = 世界从虚到实（scale/透明度/相机拉近），
// 进入 = 无缝衔接的漫游态。无 .spz 时这是主路径；有 .spz 时由 splat.js 接管并降级此层。
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { rngFromSeed } from '../core/recipe.js'

export class WorldScene {
  constructor(container) {
    this.container = container
    this._paused = false
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000)
    this.camera.position.set(0, 0.6, 9)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 3
    this.controls.maxDistance = 16
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.8
    this.controls.maxPolarAngle = Math.PI * 0.62
    this.controls.target.set(0, 0, 0)

    this.starfield = this._makeStarfield(1300)
    this.scene.add(this.starfield)
    this.panoMesh = null      // 360° 全景背景（真实世界影像）
    this.panoTex = null

    this.glow = null
    this.worldGroup = null
    this.particles = null
    this._growth = null
    this._clock = new THREE.Clock()
    this._raf = null
    this._pointer = { x: 0, y: 0 }
    this._bindPointer()
    this._bindResize()
    this._loop()
  }

  // ---- 星空 ----
  _makeStarfield(count) {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 70
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      pos[i*3] = r * Math.sin(ph) * Math.cos(th)
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th)
      pos[i*3+2] = r * Math.cos(ph)
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.06, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    return new THREE.Points(geo, mat)
  }

  // ---- 光晕（canvas 渐变，无外部资产）----
  _makeGlowTexture(hexColor) {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    const col = new THREE.Color(hexColor)
    g.addColorStop(0, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},0.9)`)
    g.addColorStop(0.4, `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},0.35)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }

  // ---- 根据配方重建世界（生长或重进）----
  setWorld(recipe) {
    this._disposeWorld()
    const pal = recipe.palette
    const rng = rngFromSeed(recipe.terrainSeed)

    // 有机世界体：二十面体 + 种子扰动
    const geo = new THREE.IcosahedronGeometry(1.5, 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const len = Math.sqrt(x*x + y*y + z*z) || 1
      const n = 0.82 + rng() * 0.36
      pos.setXYZ(i, x/len * n, y/len * n, z/len * n)
    }
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pal.primary), flatShading: true,
      emissive: new THREE.Color(pal.secondary), emissiveIntensity: 0.35,
      roughness: 0.75, metalness: 0.05, transparent: true, opacity: 0,
    })
    const world = new THREE.Mesh(geo, mat)

    // 能量线框层
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.85, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.glow), wireframe: true, transparent: true, opacity: 0.14 })
    )

    // 大气层光晕（半透明发光壳，随星球生长）
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.95, 32, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(pal.glow), transparent: true, opacity: 0,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )

    // 行星环（倾斜的发光环，华丽感）
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(pal.particle), transparent: true, opacity: 0,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    ring.rotation.x = Math.PI / 2.6
    ring.rotation.z = 0.35

    this.worldGroup = new THREE.Group()
    this.worldGroup.scale.setScalar(0.01)
    this.worldGroup.add(world, wire, atmo, ring)
    this.scene.add(this.worldGroup)

    // 光晕
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._makeGlowTexture(pal.glow), color: new THREE.Color(pal.glow),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.glow.scale.setScalar(7)
    this.scene.add(this.glow)

    // 浮动粒子
    const pc = 220
    const pgeo = new THREE.BufferGeometry()
    const ppos = new Float32Array(pc * 3)
    for (let i = 0; i < pc; i++) {
      const r = 1.8 + rng() * 2.6
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      ppos[i*3] = r * Math.sin(ph) * Math.cos(th)
      ppos[i*3+1] = r * Math.sin(ph) * Math.sin(th)
      ppos[i*3+2] = r * Math.cos(ph)
    }
    pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3))
    this.particles = new THREE.Points(pgeo, new THREE.PointsMaterial({
      color: new THREE.Color(pal.particle), size: 0.05, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.scene.add(this.particles)

    // 环境光 + 聚向光（存入成员以便重建时清理）
    this.lights = []
    const amb = new THREE.AmbientLight(0xffffff, 0.5)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 6, 5)
    this.lights.push(amb, dir)
    this.scene.add(amb, dir)
  }

  // ---- 生长动画（duration ms；onProgress 回调 0-1）----
  startGrowth(duration, onProgress) {
    if (!this.worldGroup) return
    const d = Math.max(800, duration)
    const t0 = performance.now()
    this._growth = { t0, d, onProgress: onProgress || (() => {}) }
  }

  _easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
  }
  _easeOutCubic(x) { return 1 - Math.pow(1 - x, 3) }

  _stepGrowth() {
    const g = this._growth
    if (!g) return
    const p = Math.min(1, (performance.now() - g.t0) / g.d)
    const e = this._easeOutBack(p)
    if (this.worldGroup) {
      this.worldGroup.scale.setScalar(Math.max(0.01, e))
      this.worldGroup.rotation.y = p * Math.PI * 0.6
      // 星球本体淡入
      this.worldGroup.children[0].material.opacity = p
      // 能量线框：0.14 满值淡入
      if (this.worldGroup.children[1]) this.worldGroup.children[1].material.opacity = 0.14 * p
      // 大气层：0.35 满值淡入
      if (this.worldGroup.children[2]) this.worldGroup.children[2].material.opacity = 0.35 * p
      // 行星环：0.5 满值淡入
      if (this.worldGroup.children[3]) this.worldGroup.children[3].material.opacity = 0.5 * p
    }
    if (this.glow) this.glow.material.opacity = p * 0.85
    if (this.particles) this.particles.material.opacity = p * 0.9
    if (this.worldGroup) this.worldGroup.children[0].material.opacity = p
    this.camera.position.z = THREE.MathUtils.lerp(9, 6.2, this._easeOutCubic(p))
    g.onProgress(p)
    if (p >= 1) this._growth = null
  }

  // ---- 帧循环 ----
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop())
    if (this._paused) return // splat 接管时暂停 2.5D 渲染（保留 rAF 以便恢复）
    const dt = this._clock.getDelta()
    const t = this._clock.getElapsedTime()
    if (this._growth) this._stepGrowth()
    this.starfield.rotation.y += dt * 0.006
    if (this.worldGroup) {
      this.worldGroup.rotation.y += dt * 0.05 // 自转
      this.worldGroup.position.y = Math.sin(t * 0.6) * 0.06 // 呼吸
    }
    if (this.particles) this.particles.rotation.y -= dt * 0.02
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  // ---- 鼠标视差 ----
  _bindPointer() {
    this._onPointer = e => {
      this._pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      this._pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', this._onPointer)
  }
  _bindResize() {
    this._onResize = () => {
      const w = this.container.clientWidth, h = this.container.clientHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
    }
    window.addEventListener('resize', this._onResize)
  }

  // ---- 质量降级（低端机/低帧率看门狗调用）----
  degrade() {
    this.renderer.setPixelRatio(1)
    const hideHalf = (attr) => {
      for (let i = 0; i < attr.count; i += 2) attr.setZ(i, -999)
      attr.needsUpdate = true
    }
    if (this.particles) hideHalf(this.particles.geometry.attributes.position)
    if (this.starfield) hideHalf(this.starfield.geometry.attributes.position)
  }

  // ---- 360° 全景背景：真实世界的影像层（失败静默保持星空） ----
  setPano(url) {
    if (!url || this.panoMesh) return
    this.panoTex = new THREE.TextureLoader().load(url, () => {
      try {
        // 反向球体：相机在球心向外看即是全景
        const geo = new THREE.SphereGeometry(500, 60, 40)
        geo.scale(-1, 1, 1)
        const mat = new THREE.MeshBasicMaterial({ map: this.panoTex })
        this.panoMesh = new THREE.Mesh(geo, mat)
        this.panoMesh.renderOrder = -10 // 背景层，最底
        this.scene.add(this.panoMesh)
        // 全景有了 → 星空/世界体让位，只留全景当背景
        this.starfield.visible = false
      } catch (e) { console.warn('[worldseed] pano 挂载失败：', e) }
    }, undefined, err => {
      console.warn('[worldseed] pano 加载失败，保持 2.5D 星空：', err && err.message)
    })
  }

  _disposeWorld() {
    if (this.worldGroup) {
      this.worldGroup.children.forEach(c => {
        c.geometry && c.geometry.dispose()
        c.material && c.material.dispose()
      })
      this.scene.remove(this.worldGroup)
      this.worldGroup = null
    }
    if (this.glow) { this.glow.material.dispose(); this.scene.remove(this.glow); this.glow = null }
    if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); this.scene.remove(this.particles); this.particles = null }
    if (this.lights) { this.lights.forEach(l => this.scene.remove(l)); this.lights = [] }
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    window.removeEventListener('pointermove', this._onPointer)
    window.removeEventListener('resize', this._onResize)
    this.controls.dispose()
    if (this.panoMesh) { this.panoMesh.geometry.dispose(); this.panoMesh.material.dispose(); this.scene.remove(this.panoMesh) }
    if (this.panoTex) this.panoTex.dispose()
    this._disposeWorld()
    this.starfield.geometry.dispose(); this.starfield.material.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
  }
}
