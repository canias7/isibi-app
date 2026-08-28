// THE ONE PATH TO THE 500 HAND-WRITTEN THEMES — which are PRODUCT again.
//
// They were `builder/site-theme-registry.mjs` until 2026-08-20, survived as
// test data under `test/fixtures/themes/` through the seeds era, and moved BACK
// to `builder/site-theme-registry.mjs` on 2026-08-27 (owner's call: the 500
// themes are the base of every build, with the model's free `css` as the
// on-request layer). This file stays because seven test files import through it
// and it is still the calibration corpus for every number in `site-seeds.mjs`;
// it is a re-export now, so the fixtures and the product can never disagree
// about what a theme is.
export { ALL_THEMES, THEME_IDS, resolveTheme, themeFontPair } from "../../builder/site-theme-registry.mjs";
