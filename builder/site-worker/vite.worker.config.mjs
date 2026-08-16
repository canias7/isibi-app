// The build config for a site's Worker, and it exists because of one default.
//
// `vite build --ssr` EXTERNALISES DEPENDENCIES. That is right for the
// prerender, which runs in Node with `node_modules` sitting beside it — and
// wrong here, because the Workers runtime has no loader and no modules
// directory. Measured on the first real container run: the script came out at
// 17,647 bytes, importing React and TanStack from bare specifiers, which is
// not a bundled React app and could not have been deployed.
//
// IT NEARLY SHIPPED, and how is worth keeping. The assertion meant to catch it
// checked for RELATIVE imports (`from "./…"`) and a bare `from "react"` walks
// straight past that. The size check is what caught it — a number that is
// wrong by an order of magnitude is harder to satisfy accidentally than a
// pattern. Both are asserted now.
//
// ITS OWN FILE rather than a flag on the template's config, because the two SSR
// builds want OPPOSITE things: the prerender wants externals (smaller, faster,
// Node resolves them) and this wants everything inlined. One config with a
// conditional is one edit from the prerender silently inlining React on every
// build for nothing.
import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  // NO ROUTER PLUGIN. `routeTree.gen.ts` is generated before this runs, by the
  // step that already does it — regenerating here would race the file the
  // prerender and the client build both read.
  plugins: [viteReact()],
  // The same `@` the pages are written against. Without it every kit import in
  // every generated page fails to resolve and the build produces nothing.
  //
  // RESOLVED AGAINST THE BUILD ROOT, never against this file. The config lives
  // in the build SERVICE (`/app/site-worker/` in the image, `builder/` in the
  // repo) and the template it is pointed at lives somewhere else in both — so a
  // path relative to `import.meta.url` is correct in neither. `run` sets cwd to
  // the app directory, which is the one thing true in the container and in the
  // harness's sandbox copy alike.
  resolve: { alias: { "@": path.resolve("src") } },
  ssr: {
    // THE WHOLE POINT OF THIS FILE.
    noExternal: true,
    // `webworker` picks the `worker` export condition, so a package that ships
    // a Workers-safe build gets it rather than its Node one.
    target: "webworker",
  },
  build: {
    ssr: true,
    // ONE FILE, not a directory of chunks. A Worker upload is a module and its
    // imports; splitting produces siblings the runtime cannot fetch.
    rollupOptions: { output: { format: "es", inlineDynamicImports: true } },
    // Left readable on purpose. The script is uploaded, never downloaded by a
    // visitor, so bytes here cost nothing a customer pays for — and a stack
    // trace out of a live site is worth more than the megabyte.
    minify: false,
    target: "es2022",
    emptyOutDir: true,
  },
});
