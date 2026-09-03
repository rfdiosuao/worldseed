// growParticles.js —— 生长页「星尘汇聚」粒子系统（程序化，无外部资产）
// 星尘从外围螺旋汇聚到光核，颜色取世界情绪调色板；canvas 脱离 DOM 自动停止。
export function createGrowParticles(canvas, { colors = ['#ffd28a', '#b9a8ff', '#ffffff'], count = 80 } = {}) {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let raf = 0
  let running = true

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
  }
  resize()
  window.addEventListener('resize', resize)

  const cx = () => canvas.width / 2
  const cy = () => canvas.height / 2
  const maxR = () => Math.max(canvas.width, canvas.height) * 0.62

  // 粒子：从外围向中心螺旋汇聚
  const particles = []
  for (let i = 0; i < count; i++) {
    spawn(i, true)
  }
  function spawn(i, init = false) {
    const a = Math.random() * Math.PI * 2
    const r = maxR() * (init ? Math.random() * 0.85 + 0.15 : 1.02)
    const speed = 0.6 + Math.random() * 1.1 // px/帧 向内
    const spiral = (Math.random() - 0.5) * 0.06 // 切向螺旋强度
    const size = 0.8 + Math.random() * 1.6
    particles[i] = {
      x: cx() + Math.cos(a) * r,
      y: cy() + Math.sin(a) * r,
      angle: a,
      speed,
      spiral,
      size,
      color: colors[(Math.random() * colors.length) | 0],
      life: 0,
      maxLife: 60 + Math.random() * 60,
    }
  }

  function frame() {
    if (!running) return
    if (!canvas.isConnected) { running = false; return } // overlay 销毁自动停
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'lighter'

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      p.angle += p.spiral
      p.x += Math.cos(p.angle) * p.speed
      p.y += Math.sin(p.angle) * p.speed
      p.life++
      // 到中心附近 → 重生
      const dx = p.x - cx(), dy = p.y - cy()
      if (dx * dx + dy * dy < 36 || p.life > p.maxLife) { spawn(i); continue }
      // 越近越亮
      const dist = Math.sqrt(dx * dx + dy * dy) / maxR()
      const alpha = Math.max(0, (1 - dist * 1.4)) * 0.85
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    stop() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    },
  }
}
