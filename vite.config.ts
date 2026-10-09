import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Versión de este build (spec 14): el commit en Vercel, la hora del build fuera.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`

/** Publica /version.json para que las pestañas abiertas detecten un deploy nuevo. */
function appVersion(): Plugin {
  return {
    name: 'app-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), appVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(command === 'build' ? APP_VERSION : 'dev'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
