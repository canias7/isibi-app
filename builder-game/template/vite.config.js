import { defineConfig } from 'vite'
// base './' → relative asset paths so the built game serves from /g/<slug>/ on R2
// (same trick the site builder uses for /s/<slug>/). esnext: kaplay ships modern JS.
export default defineConfig({ base: './', build: { target: 'esnext', chunkSizeWarningLimit: 3000 } })
