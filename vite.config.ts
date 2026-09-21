import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * The Client ID is inlined at build time, and without it the one-button Connect
 * is compiled out entirely — visitors get asked for a developer key instead. That
 * failure is silent, so say so in the build log (which is where Vercel shows it).
 */
function requireSpotifyClientId(): Plugin {
  return {
    name: 'clockit:spotify-client-id',
    apply: 'build',
    configResolved(config) {
      if (config.env.VITE_SPOTIFY_CLIENT_ID) return
      config.logger.warn(
        [
          '',
          '  ⚠ VITE_SPOTIFY_CLIENT_ID is not set.',
          '    This build will ask visitors for their own Spotify developer Client ID',
          '    instead of showing a one-button "Connect Spotify".',
          '    Set it in Vercel → Settings → Environment Variables, then redeploy.',
          '',
        ].join('\n'),
      )
    },
  }
}

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
    plugins: [react(), tailwindcss(), requireSpotifyClientId()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
