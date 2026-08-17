// Reconstruction of Lovable's `@lovable.dev/vite-tanstack-config`, which is a private package.
// Their vite.config.ts documents exactly what it bundles, so each piece is spelled out here:
//   tanstackStart (SSR + file-based routing) · viteReact · tailwindcss · tsConfigPaths · @ alias.
//
// THE DIVERGENCE IS CLOSED. This file said "NOT reproduced: TanStack Start + nitro SSR — their
// build renders on a server; ours ships static files" and called that the one deliberate
// divergence in the template. Ours renders on a server too now: a published site is a Worker in a
// dispatch namespace, so the reason for the divergence went away with the static hosting.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    // NO `tanstackRouter` BESIDE THIS. Start runs the route generator itself, so
    // both plugins write `src/routeTree.gen.ts` and race for it — the same
    // reason `vite.worker.config.mjs` deliberately leaves the router plugin out.
    tanstackStart(),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // `base: "./"` IS GONE, and that is a fix rather than a loss. It existed
  // because the same bundle was served at `/s/<slug>/` and at `/`, so asset
  // hrefs had to be relative and the platform Worker rewrote them per mount
  // (`absolutizeAssets`). There is one mount now, and a relative base is
  // actively wrong under SSR: `<Scripts />` emits absolute paths and a nested
  // route would resolve `./assets/…` against its own directory.
  // WHAT THE SITE'S WORKER ACTUALLY GETS. `vite build --ssr` externalises
  // dependencies by default, which is right for a Node prerender with
  // `node_modules` beside it and wrong for the Workers runtime, which has no
  // loader and no modules directory. Same reasoning — and the same `workerd`
  // condition — as `builder/site-worker/vite.worker.config.mjs`.
  //
  // It also settles a resolution hazard on its own: npm hoisted an OLDER
  // `@tanstack/router-core` (1.171.15) above the 1.171.24 every Start package
  // carries nested, so an externalised server bundle failed to load at all —
  // `does not provide an export named '_getRenderedMatches'`. Inlined, vite
  // resolves one copy through these conditions and there is nothing to skew.
  ssr: {
    noExternal: true,
    target: "webworker",
    resolve: {
      conditions: ["workerd", "module", "browser", "import", "default"],
      externalConditions: ["workerd", "module", "import", "default"],
    },
  },
  build: { chunkSizeWarningLimit: 2000 },
});
