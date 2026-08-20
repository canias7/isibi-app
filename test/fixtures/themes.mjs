// THE ONE PATH TO THE 500 HAND-WRITTEN THEMES.
//
// They were `builder/site-theme-registry.mjs` until 2026-08-20, when the theme
// registry was deleted as a product feature — the designer authors three anchor
// colours per site now (`builder/site-seeds.mjs`) instead of naming one of a
// hundred. They survive as TEST DATA because they are the corpus every number in
// that module is calibrated against; `test/fixtures/themes/registry.mjs` carries
// the full reasoning.
//
// ONE MODULE, for the reason `test/fixtures/corpus.mjs` is one: seven test files
// each spelling `../fixtures/themes/registry.mjs` is seven things to keep in
// step, and the day one drifts it imports nothing and reports a clean sweep over
// an empty corpus. Every check that measures against these palettes asserts its
// own floor on the count as well, but this says it once, at the cause.
export { ALL_THEMES, THEME_IDS, resolveTheme } from "./themes/registry.mjs";
