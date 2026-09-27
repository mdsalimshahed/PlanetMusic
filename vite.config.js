import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  css: {
    devSourcemap: true,
    modules: { localsConvention: 'camelCase' }
  },
  build: { cssMinify: 'lightningcss' }
})