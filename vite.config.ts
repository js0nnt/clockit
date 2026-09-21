import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  // Not VITE_-prefixed: this is dev-server config, and must never reach the bundle.
  const { CLOCKIT_API_TARGET } = loadEnv(mode, process.cwd(), 'CLOCKIT_')

  return {
    server: {
      // Spotify rejects `localhost` as a redirect host, so bind the IPv4 loopback
      // explicitly — on Windows `localhost` resolves to ::1 and 127.0.0.1 is refused.
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // `vite dev` does not run the functions in api/. Pointing this at a deployment
      // lets local development sync against the same account storage.
      proxy: CLOCKIT_API_TARGET
        ? { '/api': { target: CLOCKIT_API_TARGET, changeOrigin: true } }
        : undefined,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
