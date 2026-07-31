// docs/components.md is generated. This is the guard that keeps it true.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { render } from "../builder/gen-components-doc.mjs";

test("docs/components.md matches the components", () => {
  assert.equal(render(), fs.readFileSync("docs/components.md", "utf8"),
    "docs/components.md is stale — run `node builder/gen-components-doc.mjs`");
});
