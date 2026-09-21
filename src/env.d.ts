/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The deployment's own Spotify app. Baked in at build time so visitors can just
   * press Connect; PKCE has no secret, so this is public by design.
   */
  readonly VITE_SPOTIFY_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
