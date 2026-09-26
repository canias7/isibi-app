// A COMMENT BETWEEN TWO CLASSES, AND WHICH RULE REACHES THE PAGE (2026-09-26).
//
// Owner: *"Add this route regression and a browser-backed control establishing
// which selector matches the fixture."* One page, one element — `<p class="a
// b">` with nothing inside it — and each spelling a lane might write of a rule
// aimed at it: `judged` is the string `plainSelectors` hands the build
// service's judge for that rule, and `live` whether the rule reaches the
// element.
//
// `live` IS THE BROWSER'S, NOT OURS. test/integration/site-build.mjs, which the
// site-build workflow runs with a real Chromium, asserts every entry against
// the page's own cascade and its own `querySelectorAll`. The unit cases that
// take their page judge from this table (test/edit-failure-paths.test.mjs,
// test/css-scope.test.mjs) inherit that reading rather than a liveness assumed
// in JavaScript — the unit workflow has no browser, so an assertion there
// about what a page matches would be vacuous. The workflow lists this file
// among its paths, so a change here runs the browser half again.

const TEXT = "Fresh bread from 7am, Tuesday to Sunday.";

/** The paragraph's classes, the same in the page source and in the document. */
export const PAGE_CLASSES = "a b";
/** The paragraph as a generated page writes it. */
export const PARAGRAPH_JSX = "<p className=\"" + PAGE_CLASSES + "\">" + TEXT + "</p>";
/** The paragraph as the browser receives it. */
export const PARAGRAPH_HTML = "<p class=\"" + PAGE_CLASSES + "\">" + TEXT + "</p>";

/** A rule aimed at the paragraph, spelled `sel`. */
export const RULE = (sel) => sel + "{color:#014421}";

// THE OWNER'S PAIR: the stored rule, and the one the lane wrote in its place.
export const STORED_SEL = ".a/**/.b";
export const WRITTEN_SEL = ".a .b";

export const SPELLINGS = Object.freeze([
  // A comment is consumed without producing whitespace, so this is the compound
  // `.a.b` — the browser's own stylesheet object serialises it that way.
  Object.freeze({ written: STORED_SEL, judged: ".a/**/.b", live: true }),
  // A descendant: nothing inside the paragraph carries `b`.
  Object.freeze({ written: WRITTEN_SEL, judged: ".a .b", live: false }),
  // A comment with words in it is the same boundary.
  Object.freeze({ written: ".a/* the hours */.b", judged: ".a/**/.b", live: true }),
  // A comment beside whitespace is part of that whitespace.
  Object.freeze({ written: ".a /* the hours */ .b", judged: ".a .b", live: false }),
  // What the walker's blanked copy handed the judge for `.a/**/.b` before
  // 2026-09-26 — a descendant, so the string meant something the rule did not.
  Object.freeze({ written: ".a    .b", judged: ".a    .b", live: false }),
  // The same element, written without the comment.
  Object.freeze({ written: ".a.b", judged: ".a.b", live: true }),
]);
