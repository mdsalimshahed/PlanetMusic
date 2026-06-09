import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    // Ensures CSS is processed but not over‑optimized
    devSourcemap: true,
    modules: {
      // If you use CSS modules, adjust accordingly
      localsConvention: 'camelCase'
    }
  },
  build: {
    // Prevent aggressive CSS minification that might remove important rules
    minify: 'terser',
    cssMinify: 'lightningcss'
  }
})