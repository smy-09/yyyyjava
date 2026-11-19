import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  // 打包后 index.html 里的资源用相对路径引用，
  // 这样 dist 丢到任何目录 / 挂到 nginx 子路径下都能直接用
  base: './',

  server: {
    port: 5173,

    // 【重要】端口被占用时直接报错退出，不要自动换成 5174/5175。
    // 原因：后端代理、浏览器书签、脚本里写的都是 5173，
    //       如果 vite 悄悄换了端口，会出现「页面能开但接口 404」这种很难查的问题。
    strictPort: true,

    // 优化点：不要每次启动都自动打开浏览器
    // （原来 open: true 会拖慢启动，而且 IDE 里会弹窗很烦）
    open: false,

    // 【关键】开发代理：前端所有 /api 开头的请求都转发到后端 8080。
    // 有了代理，浏览器看到的是同源请求，不存在跨域，也不用手写 CORS。
    // 注意：后端端口如果改了（application.yml 里的 server.port），
    //       这里的 target 也要同步改。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
        // 后端接口本身就带 /api 前缀，所以这里不需要 rewrite
      }
    },

    // 优化点：预热常用文件，首次访问页面时少等一点
    warmup: {
      clientFiles: ['./src/main.js', './src/App.vue', './src/store.js']
    }
  },

  build: {
    // 优化点：关闭 sourcemap，打包更快、产物体积更小
    sourcemap: false,
    // 单 chunk 超过 1MB 才警告（默认 500KB，容易刷屏）
    chunkSizeWarningLimit: 1000
  },

  // 优化点：依赖预构建，把 vue 等依赖提前编译好并缓存，
  // 第二次启动 dev server 会明显快很多
  optimizeDeps: {
    include: ['vue']
  }
})
