// Ensure lightningcss uses the WASM fallback in build environments
// where the native binary may be missing (Vercel, CI, etc).
process.env.LIGHTNING_CSS_FORCE_WASM = process.env.LIGHTNING_CSS_FORCE_WASM || '1';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default async () => {
  // Dynamically import tailwind plugin after forcing wasm fallback
  const tailwindcss = (await import('@tailwindcss/vite')).default;
  return defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': 'http://localhost:5050',
      },
      allowedHosts: ['f91a54fd4849.ngrok-free.app'],
    },
  })
}
