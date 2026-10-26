# An entry the list already has is asked about, never added twice (2026-10-26)

**Live case.** An earlier add-on put "Group lessons (beginners and improvers)" into `lessons` twice (ids 5 and 9), so test 11's price change had to ask which of two identical rows it meant.

**Fix.**
- `builder/site-add.mjs`: `rowNameOf` reads an entry's own name from `name`, `title` or `label` only. `duplicateRows` asks, read-only and parameterised, whether the list already has that name, ignoring case and surrounding spaces.
- `duplicateAsk` offers "Add another one anyway" or "Leave it as it is", and says how to change the existing entry. `duplicateAnswer` reads the answer back from the request's context.
- `worker.js` (the add-on's row path) runs the check after the entry is cleaned, before preparation, the charge and the write:
  - a duplicate asks, free;
  - "add anyway" goes on;
  - "leave it", or any other answer, adds nothing, free.
- A check that cannot be answered fails open, as before. An entry with no name column is never held back.

**Checks.**
- `test/addon-row-duplicate.test.mjs`, 4 cases. Red: fails before the change.
- Sweep: 5 of 5 killed; the comment control survived.
- Every test file touching the row path: 452 of 452 pass.
