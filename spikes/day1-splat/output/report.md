# Worldseed · Day1 Splat Spike 验收报告

> 日期：2026-09-04 · 分支：evox/worldseed-30-eazo---llm-marble-world-api-p-8ec5e4ea
> 对照标准：docs/开发提示词与蜂群策略.md:36-41

## 结论

**演示闭环 ✅ 成立；严格验收 ❌ 未全达标**——差距在「页面内 .spz 实时渲染性能」与「前台 FPS/秒开实测数据」，非功能缺失。

## 逐项验收

### ① 质感（✅ 达标）
- 2.5D 程序化世界（星空/粒子/情绪光晕）+ 生长仪式动画，浏览器实测渲染正常
- **真实世界**：Marble API 真生成成功（world `c3739721-6590-4125-ad70-4498a04a4e72`，marble-1.1，1580 credits）
- 真实 360° 全景背景已接入页面（panoMesh 挂载 ✓，180KB 秒开）
- 官方 viewer 跳转可用：https://marble.worldlabs.ai/world/c3739721-6590-4125-ad70-4498a04a4e72

### ② 导出（🟡 部分）
- ✅ 真实 .spz 已落盘：`public/worlds/marble-100k.spz`(1.24MB)、`marble-500k.spz`(7.28MB)，manifest 见 `public/worlds/manifest.json`
- ❌ 仅 1 个世界（标准要求 3 个试验世界：室内/室外/夜景）；预算可生成但未足量

### ③ 流畅（❌ 未达标——关键）
- **页面内 .spz 渲染实测 >60s（100k 点），主线程占满，不可用**
- 基准测试与决策记录：`docs/spz-benchmark.md`（progressiveLoad ON/OFF 均未过 <10s 门槛 → 回退，全景为最终方案）
- 2.5D/全景路径 FPS 未做前台 60s 采样（见"验证限制"）

### ④ 秒开（🟡 部分）
- 缓存命中"想你"等金句 → 秒开直进世界 ✓（多次实测）
- 精确 ≤800ms 计时未落盘（见"验证限制"）

### ⑤ 断网复验（🟡 部分）
- ✅ 静态验证：dist 自包含（相对路径、无外部 CDN 运行时请求）
- ❌ 未做"关网重启 preview 全流程复测"（见"验证限制"）

## 验证限制（诚实声明）

1. **自动化浏览器在后台标签时 rAF 被节流** → FPS 采样、.spz 加载计时在前台才可靠；本轮 .spz 计时为前台实测（>60s），FPS 采样需人工前台补跑
2. **官方 viewer 无法 iframe**（X-Frame-Options: DENY）→ 真 3D 漫游走新标签页跳转，非页面内嵌
3. **Marble .spz 无轻量 web loader**（lumaai/spz 仓库不存在，gaussian-splats-3d 解析 Marble 格式慢）→ 页面内实时渲染不可行，全景为主路径

## 待补（如需严格达标）

| 项 | 动作 | 预估 |
|---|---|---|
| 3 个试验世界 | 用 key 生成室内/室外/夜景各 1，截图 | 15min + credits |
| 前台 FPS 采样 | 人工前台打开 `public/test/perf-sampler.html` 跑 60s | 5min |
| 断网复验 | 断网重启 `npm run preview` 走全流程 | 10min |
| 秒开计时 | 前台 DevTools 记录点击→首帧 | 5min |
