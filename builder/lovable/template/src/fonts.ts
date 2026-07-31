// Overwritten per build by build-server.mjs. Do not edit.
//
// It exists in the template so main.tsx has something to import and the template
// builds standalone. A build rewrites it with only the fonts that site chose —
// importing all 24 statically would bundle 21 MB of typefaces into every site.
//
// The VALUES live in styles.css's @theme block, not here: a `:root` of our own is
// dropped by the minifier once Tailwind's own `:root` lands after it, which
// shipped the default font while the build reported the chosen one.
import "@fontsource-variable/geist";
