# SPZ 渲染性能基准（B 轨决策记录）

> 日期：2026-09-04 · 项目：一念成界 Worldseed · 决策点：Marble .spz 是否作为页面内渲染层

## 测试条件

- 库：`@mkkellogg/gaussian-splats-3d@0.4.7`（three 0.170）
- 资产：Marble 真实生成世界 `c3739721-6590-4125-ad70-4498a04a4e72` 的 100k 档 `.spz`（1.24MB）
- 环境：本机 Chrome（后台标签页节流已规避，前台实测）
- Viewer 配置：`optimizeSplatData:false`、`sphericalHarmonicsDegree:0`

## 对照结果

| 模式 | 首帧时间 | 结论 |
|---|---|---|
| `progressiveLoad: false` | >60s（主线程被解析占满，CDP 30s 超时） | ❌ 不可用 |
| `progressiveLoad: true` | >30s（30s 内无 `splatRenderCount>0`，主线程占满） | ❌ 未达标 |

## 决策

**B 轨不达标（首帧 <10s 门槛未过）→ 回退 `progressiveLoad:false`，Marble .spz 不作为页面内实时渲染主路径。**

- 主路径：**全景背景（pano）**——真实世界的 360° 影像，压缩后 180KB，秒开稳定
- 官方 viewer 跳转保留（`world_marble_url`，新标签页真 3D 漫游）
- `.spz` 下载保留（预生成世界库备用，未来接专用轻量 loader 或 GPU 直解析再评估）

## 原因分析

Marble 的 `.spz` 文件是 3D 高斯溅射的压缩二进制（含 SH 球谐数据），`@mkkellogg/gaussian-splats-3d` 解析时在**主线程**做完整解码 + 数据结构构建，100k 点即需 60s+。该库对 Marble 生产格式无渐进/流式优化（其 progressiveLoad 针对自产 .ksplat 分块格式）。

## 替代方向（未来，不在 72h 主路径）

1. World Labs 官方 JS SDK / 轻量 .spz loader（需调研是否存在）
2. 预生成世界库阶段直接转 .splat（我们已验证 27 万点 .splat 可被 0.4.7 解析建树）——把 Marble .spz 预转换后走 splat 管线
3. GPU 侧解析（WebGPU compute shader 解 .spz），工程量远超黑客松
