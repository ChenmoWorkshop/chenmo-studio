import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 部署方式：与主站一起发布，通过 https://chenmo-studio.app.workbuddy.host/admin-app/ 访问
// （发布工具在同一项目下只能绑定一个站点，第二个域名不会被创建，故采用子路径而非独立域名）
// 云函数已放行所有 *.app.workbuddy.host 子域，无需额外配 CORS
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 5273, host: '127.0.0.1' },
  build: { outDir: '../admin-app', emptyOutDir: true, target: 'es2018' }
})
