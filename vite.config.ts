import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/directus': {
        target: process.env.VITE_DIRECTUS_PROXY_TARGET ?? 'http://124.223.157.37:8055',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/directus/, ''),
      },
    },
  },
})
