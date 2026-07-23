// Batch 292 — iCALENDAR FEED. A stateless generator turning events into a downloadable .ics (VCALENDAR).
// Covers a basic VEVENT, timed + all-day formatting, escaping, multiple events, content-type, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 292");
const slug = "b292";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const gen = (body) => c.post(`/api/db/${slug}/ical`, body);

// --- Basic ---
let r = await gen({ name: "My Cal", events: [{ title: "Launch Party", start: "2026-08-01T18:00:00Z", end: "2026-08-01T20:00:00Z", location: "HQ, Floor 3", description: "Drinks; snacks" }] });
t.eq(r.status, 200, "generates a calendar");
const ics = r.text;
t.ok(/BEGIN:VCALENDAR/.test(ics) && /END:VCALENDAR/.test(ics), "wraps in VCALENDAR");
t.ok(/X-WR-CALNAME:My Cal/.test(ics), "carries the calendar name");
t.ok(/BEGIN:VEVENT[\s\S]*SUMMARY:Launch Party[\s\S]*END:VEVENT/.test(ics), "emits a VEVENT with the summary");
t.ok(/DTSTART:20260801T180000Z/.test(ics), "formats the start as a UTC timestamp");
t.ok(/DTEND:20260801T200000Z/.test(ics), "…and the end");
t.ok(/LOCATION:HQ\\, Floor 3/.test(ics), "escapes commas in the location");
t.ok(/DESCRIPTION:Drinks\\; snacks/.test(ics), "escapes semicolons in the description");
t.ok(/UID:/.test(ics), "assigns a UID");

// --- All-day event uses VALUE=DATE ---
r = await gen({ events: [{ title: "Holiday", start: "2026-12-25", allDay: true }] });
t.ok(/DTSTART;VALUE=DATE:20261225/.test(r.text), "an all-day event uses a DATE value");

// --- Multiple events ---
r = await gen({ events: [{ title: "A", start: "2026-08-01T10:00:00Z" }, { title: "B", start: "2026-08-02T10:00:00Z" }] });
t.eq((r.text.match(/BEGIN:VEVENT/g) || []).length, 2, "emits both events");

// --- Provided UID is kept ---
r = await gen({ events: [{ uid: "evt-123@myapp", title: "X", start: "2026-08-01T10:00:00Z" }] });
t.ok(/UID:evt-123@myapp/.test(r.text), "a supplied UID is preserved");

// --- Validation ---
t.eq((await gen({ events: [] })).status, 400, "no events → 400");
t.eq((await gen({ events: [{ start: "2026-08-01T10:00:00Z" }] })).status, 400, "an event with no title → 400");
t.eq((await gen({ events: [{ title: "X", start: "not-a-date" }] })).status, 400, "a bad start → 400");

t.done(); h.restore();
