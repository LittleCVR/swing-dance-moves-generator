import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function computeHash() {
  return Math.random().toString(36).slice(2, 10)
}
const BUILD_HASH = computeHash()

// https://vite.dev/config/
export default defineConfig({
  base: '/swing-dance-moves-generator/',
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  plugins: [react(), tailwindcss()],
})
