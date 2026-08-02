// college /courses — the course finder: searchable, filterable, and
// honest about entry requirements per subject. Tasks over marketing all the
// way down; a sixth-former wants the grades line, not a stock photo.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CategoryNav } from "@/components/ui/category-nav";
import { DataTable } from "@/components/ui/data-table";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
export const Route = createFileRoute("/courses")({ component: P });
const CHROME = {
  name: "Rivelin College", tagline: "A sixth-form college in the Rivelin valley.",
  links: [{ label: "Home", href: "#/" }, { label: "Courses", href: "#/courses" }, { label: "Visit us", href: "#/visit" }],
  action: { label: "Apply", href: "#/apply" },
};
const COURSES = [
  { name: "Mathematics", area: "sciences", level: "A-level", entry: "Grade 7 in GCSE Maths", note: "Further Maths runs alongside" },
  { name: "Physics", area: "sciences", level: "A-level", entry: "6-6 in Combined Science, 6 in Maths", note: "Taken with Maths by almost everyone" },
  { name: "Biology", area: "sciences", level: "A-level", entry: "6-6 in Combined Science", note: "The largest department" },
  { name: "English Literature", area: "arts", level: "A-level", entry: "Grade 6 in English", note: "Theatre trips are not optional and not expensive" },
  { name: "Fine Art", area: "arts", level: "A-level", entry: "Portfolio conversation, not grades", note: "Studios open until 6" },
  { name: "History", area: "humanities", level: "A-level", entry: "Grade 6 in English or History", note: "Tudors and the Cold War" },
  { name: "Sociology", area: "humanities", level: "A-level", entry: "Grade 5 in English", note: "No GCSE needed — most start fresh" },
  { name: "Engineering", area: "vocational", level: "BTEC Extended", entry: "Merit profile at GCSE incl. Maths 5", note: "Day release with local employers in year two" },
  { name: "Health & Social Care", area: "vocational", level: "BTEC Extended", entry: "Grade 4 in English", note: "Placement from the first term" },
];
function P() {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const shown = COURSES.filter((c) =>
    (!area || c.area === area) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Find your course</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Every course we run in 2027 entry, with the honest entry line. If your grades land near a boundary, apply anyway — the conversation exists for exactly that.</p>
        <div className="mt-6 grid gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Course name — 'maths', 'art', 'engineering'…" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CategoryNav active={area} onSelect={setArea} items={[
              { key: "sciences", label: "Sciences", count: 3 },
              { key: "arts", label: "Arts", count: 2 },
              { key: "humanities", label: "Humanities", count: 2 },
              { key: "vocational", label: "Vocational", count: 2 }]} />
            <ResultCount total={shown.length} noun="course" filtered={!!q || !!area} />
          </div>
        </div>
        <DataTable className="mt-5" empty="Nothing matches — clear the filters or ask admissions; the list grows most years."
          columns={[
            { key: "name", header: "Course" },
            { key: "level", header: "Level" },
            { key: "entry", header: "You'll need" },
            { key: "note", header: "Worth knowing" },
          ]} rows={shown} />
        <p className="mt-8 rounded-xl border bg-muted/40 p-5 text-sm">Pick three or four, then <a className="font-medium underline underline-offset-4" href="#/apply">start the application</a> — you change subjects at enrolment more easily than people expect, and <a className="font-medium underline underline-offset-4" href="#/visit">an open evening</a> is the fastest way to be sure.</p>
      </div>
    </SiteChrome>
  );
}
