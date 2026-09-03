import { defineConfig } from 'vite'

// 零 CDN、相对路径、断网可演示
export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 80000, // 80KB 内资源内联，减少离线请求
    target: 'es2019',
  },
  server: {
    host: true, // 允许局域网/手机访问
    port: 5173,
  },
})
