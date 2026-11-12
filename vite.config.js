import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // NEXT_PUBLIC_ too: the Supabase–Vercel integration names its keys that way.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
