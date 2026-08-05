import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // Route search requests to Render
      '/search-deezer': {
        target: 'https://ytdownloader-jnt0.onrender.com',
        changeOrigin: true,
        secure: true,
      },
      // Route streaming/download requests to Render
      '/download-deezer': {
        target: 'https://ytdownloader-jnt0.onrender.com',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase'
    }
  },
  build: {
    cssMinify: 'lightningcss'
  }
})