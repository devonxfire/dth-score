// Ensure lightningcss uses the WASM fallback if the env var is not set
process.env.LIGHTNING_CSS_FORCE_WASM = process.env.LIGHTNING_CSS_FORCE_WASM || '1';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
    },
    allowedHosts: ['f91a54fd4849.ngrok-free.app'],
  },
})
