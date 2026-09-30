// THE CANARY'S OWN ROUTING LINE, evaluated on a route's real answer.
//
// `scripts/edit-canary.mjs` prints what the router said in one template literal
// right after the routing call, and keeps the answer itself in `routing.json`
// (`body: rd`). The line is taken from the script's SOURCE, landmark to
// landmark, and evaluated with nothing but the three names it uses, so a test
// reads the words the canary would really print, not a copy of them that could
// drift. `routing.json`'s share is the answer's own JSON, which a test already
// holds as the route's reply.
import { readFileSync } from "node:fs";
import { failureSaid } from "../../scripts/canary-route.mjs";

const SRC = readFileSync(new URL("../../scripts/edit-canary.mjs", import.meta.url), "utf8");
const LANDMARK = "console.log(`  routed in ";
const at = SRC.indexOf(LANDMARK);
if (at < 0) throw new Error("the canary's routing line moved: its landmark is gone");
const open = at + LANDMARK.length - "  routed in ".length - 1;
const close = SRC.indexOf("`);\n", open + 1);
if (close < 0 || SRC.slice(open + 1, close).includes("\n")) throw new Error("the canary's routing line is no longer one template literal");
const line = new Function("rt", "rd", "failureSaid", "return `" + SRC.slice(open + 1, close) + "`;");

/** What the canary prints for a routing answer `rd` that took `rt.ms`. */
export const canaryRoutingLine = (rt, rd) => line(rt, rd, failureSaid);
