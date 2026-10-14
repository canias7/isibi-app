// WHAT COUNTS AS AN EMOJI OR A CHECKMARK IN THE TESTS, PINNED (2026-10-14).
//
// The owner's rule: no emoji or checkmarks in what the builder says unless the
// customer asks. The tests used to read that as `\p{Extended_Pictographic}`,
// which is whatever the running Node's Unicode tables say. Node 22.22 ships
// Unicode 16; Node 22.23 (CI's, from run 38503645857) ships Unicode 17, which
// took 689 characters out of the property — ★ ☐ ☒ ⚑ ✎ among them — and added
// none. The same test then found less on CI than here, and the allowance for
// the pricing badge's ★ matched nothing there.
//
// So the set is fixed here, independent of the runtime:
//   - every character Unicode 16 calls Extended_Pictographic (as ranges);
//   - the checkmarks, crosses and the white star that were never in it
//     (✓ U+2713, ✕ U+2715, ✗ U+2717, ✘ U+2718, ☆ U+2606);
//   - and whatever the running Node's property adds, should a later Unicode
//     add one.
// It can only find more than before, never less.
/** One character that is an emoji, a pictograph or a checkmark. */
export const PICTOGRAPH = new RegExp("[\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9-\u21AA\u231A-\u231B\u2328\u2388\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA-\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2612\u2614-\u2685\u2690-\u2705\u2708-\u2718\u271D\u2721\u2728\u2733-\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763-\u2767\u2795-\u2797\u27A1\u27B0\u27BF\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\u{1F000}-\u{1F0FF}\u{1F10D}-\u{1F10F}\u{1F12F}\u{1F16C}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1AD}-\u{1F1E5}\u{1F201}-\u{1F20F}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F23C}-\u{1F23F}\u{1F249}-\u{1F3FA}\u{1F400}-\u{1F53D}\u{1F546}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F774}-\u{1F77F}\u{1F7D5}-\u{1F7FF}\u{1F80C}-\u{1F80F}\u{1F848}-\u{1F84F}\u{1F85A}-\u{1F85F}\u{1F888}-\u{1F88F}\u{1F8AE}-\u{1F8FF}\u{1F90C}-\u{1F93A}\u{1F93C}-\u{1F945}\u{1F947}-\u{1FAFF}\u{1FC00}-\u{1FFFD}\\p{Extended_Pictographic}]", "u");
