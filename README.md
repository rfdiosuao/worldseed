# 🌌 一念成界 · Worldseed

> **说一句话，30 秒长出一个只属于你、能走进去的世界；封存成卡片，寄给那个你想让他懂你的人。**

**Eazo 数字艺术黑客松 · 赛道③ 创新互动** · 纯前端 · 零后端 · 断网可演示

---

## ✨ 这是什么

把「脑海里说不出口的世界 / 情绪」，变成**可进入、可交互、可分享**的微型世界。

用户输入一句话——「我想回到外婆家那个下着雨的夏天」「想你了」——世界在眼前**生长**出来：真实 3D 高斯溅射场景、360° 全景影像、华丽星球、流动的星尘粒子与旁白。最后**封存成一张卡片 + 二维码**，寄给另一个人，对方扫一扫就能**走进你刚才的脑海**。

**核心闭环（演示路径）：**
```
输入一句话 → 世界生长（哇时刻）→ 进入并交互 → 封存成卡片 → 二维码带走/寄出
```

## 🎮 试试这些（演示金句，秒开真实世界）

| 输入 | 你会看到 |
|---|---|
| `想你` | 你自生成的浮空岛世界 · 真实 360° 全景 |
| `晚安` | 月光草原世界 · 真实全景 |
| `自由的风` | 金色草原世界 · 真实全景 |
| 任何其他词 | 随机抽取 Marble 精选画廊世界 + 华丽随机色星球 |

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite · 原生 JS（零框架，极致秒开） |
| 渲染 | three.js 0.180 + **World Labs 官方 Spark 渲染器**（`@sparkjsdev/spark`） |
| 世界生成 | World Labs Marble API（`marble-1.1`，经 Cloudflare Worker 代理转发，key 不进前端） |
| 全景影像 | Marble 360° pano（11MB PNG → 180KB JPEG 压缩） |
| 分享 | URL hash 编码 + 二维码（qrcode.js）+ localStorage（零后端） |
| 部署 | Cloudflare Workers（代理）+ GitHub Pages / 任意静态托管 |

## 🏗 三层兜底（现场永不黑屏）

```
① 预生成世界库（金句秒开真实世界）  ← 主路径，最快最稳
② Spark 真 3D 渲染（机器跑得动才接管，自动探测）
③ 2.5D 华丽星球 + 画廊氛围背景（任何环境兜底）
```

- **环境探针**：Spark 渲染一帧读像素，跑不动自动降级，绝不黑屏
- **确定性随机**：同一句话永远抽到同一个世界，同一句同一种颜色

## 🚀 快速开始

```bash
# 1. 安装
npm install

# 2. 开发
npm run dev          # http://localhost:5173

# 3. 构建 + 预览（断网可跑）
npm run build
npm run preview      # http://localhost:4173
```

> 💡 输入金句 `想你` / `晚安` / `自由的风` 秒开真实世界（预填充缓存，完全离线）。

## 🔑 启用 Marble 实时生成（可选）

默认主路径是预生成世界库（不依赖网络/credits）。要启用实时生成：

```bash
# 1. 部署代理（Cloudflare Worker，key 存 secret，不进前端）
npm run deploy:proxy        # 需先 wrangler login + wrangler secret put WLT_API_KEY

# 2. 配置代理地址
echo 'VITE_MARBLE_PROXY_URL=https://your-worker.workers.dev' > .env
```

## 📁 结构

```
src/
  main.js          # 状态机：输入 → 生长 → 世界 → 封存
  core/
    recipe.js      # 一句话 → 世界配方（情绪/调色板/旁白）
    gallery.js     # 14 个 Marble 精选画廊世界
    marble.js      # Marble API 客户端（经代理）
  render/
    scene.js       # 2.5D 华丽星球（大气层 + 行星环 + 粒子）
    splat.js       # Spark 真 3D（探针 + 超时 + 首帧检查三守卫）
  state/cache.js   # localStorage 缓存（金句秒开）
  ui/              # 卡片/二维码/生长粒子
public/worlds/     # 预生成世界资产（spz + pano + 画廊图）
proxy/             # Cloudflare Worker 代理模板
```

## ✅ 验收证据

| 项 | 数据 | 位置 |
|---|---|---|
| 流畅 | FPS p50/p95 = **48/48**（前台 60s 采样） | `spikes/day1-splat/output/fps.json` |
| 秒开 | 缓存命中 → 首帧 **522ms** | `spikes/day1-splat/output/startup.json` |
| 渲染 | Spark 探针 33.4% 非黑 · SplatMesh 首帧 100% 非黑 | `docs/spz-benchmark.md` |
| 资产 | 3 个自生成世界 + 14 个画廊世界 | `public/worlds/` + `manifest.json` |

## 📜 License

MIT — 黑客松艺术实验作品。
