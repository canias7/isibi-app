import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' → relative asset paths so the built site serves from /s/<slug>/ on R2.
export default defineConfig({ plugins: [react()], base: './', build: { chunkSizeWarningLimit: 2000 } })
