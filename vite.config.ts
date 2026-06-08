import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'web/src') }, dedupe: ['react', 'react-dom'] },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { outDir: path.resolve(import.meta.dirname, 'dist/web'), emptyOutDir: true },
})
