import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, './src/app'),
      '@user': path.resolve(__dirname, './src/user'),
      '@admin': path.resolve(__dirname, './src/admin'),
      '@auth': path.resolve(__dirname, './src/auth'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@db': path.resolve(__dirname, './src/supabase'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
})
