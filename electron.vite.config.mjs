import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    server: {
      // 本机默认只监听 IPv6 [::1]，而 Chromium 解析 localhost 优先走 IPv4 127.0.0.1，
      // 连不上导致白屏且 ready-to-show 永不触发。显式绑定 IPv4 回环。
      host: '127.0.0.1'
    }
  }
})
