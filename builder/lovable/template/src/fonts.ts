// Overwritten per build by build-server.mjs. Do not edit.
//
// It exists in the template so `routes/__root.tsx` has something to import and
// the template builds standalone. (That import was in `main.tsx` until TanStack
// Start; it moved so the SERVER render emits the typeface's <link> tags too —
// reaching the client only was fine while the server render was a throwaway
// snapshot and is not fine now that the browser hydrates it.)
// A build rewrites it with only the fonts that site chose —
// importing all 24 statically would bundle 21 MB of typefaces into every site.
//
// The VALUES live in styles.css's @theme block, not here: a `:root` of our own is
// dropped by the minifier once Tailwind's own `:root` lands after it, which
// shipped the default font while the build reported the chosen one.
import "@fontsource-variable/geist";
