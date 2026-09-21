import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Spotify rejects `localhost` as a redirect host, so bind the IPv4 loopback
  // explicitly — on Windows `localhost` resolves to ::1 and 127.0.0.1 is refused.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
