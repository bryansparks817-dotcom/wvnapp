import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Writes sw.js into the build with this build's file list, so the phone keeps
// a full copy of the app for when there's no signal.
function offlineCopy() {
  return {
    name: 'the-pass-offline-copy',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map')).map((f) => `/${f}`)
      const extras = ['/favicon.svg']
      const source = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8')
        .replace('__BUILD__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify([...files, ...extras]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineCopy()],
  // NEXT_PUBLIC_ too: the Supabase–Vercel integration names its keys that way.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
