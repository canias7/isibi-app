// Reconstruction of Lovable's `@lovable.dev/vite-tanstack-config`, which is a private package.
// Their vite.config.ts documents exactly what it bundles, so each piece is spelled out here:
//   tanstackRouter (file-based routing) · viteReact · tailwindcss · tsConfigPaths · @ path alias.
// NOT reproduced: TanStack Start + nitro SSR. Their build renders on a server; ours ships static
// files, so this is a client-rendered SPA with the same file-based routing conventions. That is
// the one deliberate divergence in the template — see docs/owner-notes.md.
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', routesDirectory: 'src/routes', generatedRouteTree: 'src/routeTree.gen.ts', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
})
