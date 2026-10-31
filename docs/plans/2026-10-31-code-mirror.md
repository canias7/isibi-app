# One set of files: the Code tab mirrors the site's folder (plan, 2026-10-31)

The owner: the Code tab and the site's files in storage must be the same set,
"no one side having more than another", so the customer knows exactly what is
in their project. New sites only; existing sites are left as they are.

## Today

The Code tab is put together from five places:

| Shown in the Code tab | Where it really lives |
|---|---|
| pages (`src/routes/*.tsx`) | `source/<slug>/pages.json` (R2) |
| the site's own components (`-parts/…`) | `source/<slug>/parts.json` (R2) |
| kit components the site uses | `source/<slug>/kit.json` (R2, a list) |
| the starter files (router, root, lib, hooks, project root) | bundled into the Worker (`FOUNDATION_FILES`), not in R2 |
| assets (logo, icon) | derived from the site's config |

And some files the site really runs on are shown nowhere: the stylesheet (kept
in the config, not as a file) and the files the build writes itself
(`site-brand.ts`, fonts, icons, theme).

## After

1. **One folder per site holds the whole project.** `source/<slug>/files/<path>`,
   one R2 object per file, plus `source/<slug>/files.json`: the list of every
   path with its size and hash. That list *is* the project.
2. **What goes in it:** everything the build compiles from: the starter files,
   the kit components the site uses, the AI's pages and components,
   `styles.css` as a real file, and the files the build generates. Not
   `node_modules`, not the compiled output, not uploads (those keep their own
   folders, which are media and output, not code).
3. **Written by the build, after every successful save.** The container already
   has the full project on disk when it compiles; it uploads the files that
   changed and writes the new list. A failed save writes nothing.
4. **The Code tab and Download read only that list.** No bundled starter files,
   no assembling from five places: the tab is a straight view of the folder.
5. **The compiler starts from the folder.** Each compile lays the site's stored
   files over the template, so what the tab shows is what runs.
6. **The agent reads the same folder.** Its workspace is the stored project;
   what it may write is unchanged for now (pages, components, stylesheet).
7. **Old sites:** no `files.json`, so they keep today's tab, unchanged.

## Order of work

1. Container: write `files/` + `files.json` after a successful compile (new sites).
2. Worker: `/api/site/source` answers from `files.json` when it exists.
3. Browser: the Code tab and Download render that list as it is.
4. Compile: overlay the stored files before building.
5. Agent: read its workspace from the folder.

Each step ships with tests; the first live check is one new build whose Code
tab is compared, file by file, with its folder.

## Open questions for the owner

- Should the customer (or the agent) later be able to edit the starter files
  too? This plan keeps them read-only, but stores them, so allowing it later
  is a small change.
