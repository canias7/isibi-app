// festival /lineup — the grid, by day and stage. Everybody reading this is
// deciding what to miss, so the clashes are the point.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LineupGrid } from "@/components/ui/lineup-grid";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/lineup")({ component: P });
const DAYS = [
  { day: "Friday", acts: [
    { name: "Loxley Brass", stage: "Main", start: "17:00", end: "17:45" },
    { name: "Nether Edge", stage: "Main", start: "18:15", end: "19:15", billing: "support" as const },
    { name: "The Wire", stage: "Main", start: "19:45", end: "21:00", billing: "main" as const },
    { name: "Elsie Marrow", stage: "Main", start: "21:30", end: "22:45", billing: "headline" as const },
    { name: "Pit Ponies", stage: "Barn", start: "18:00", end: "18:45" },
    { name: "Crookes Quartet", stage: "Barn", start: "19:30", end: "20:15" },
    { name: "Sam Okonkwo (spoken)", stage: "Barn", start: "21:00", end: "21:45" },
    { name: "DJ Crookes", stage: "Late", start: "23:00", end: "01:30" },
  ] },
  { day: "Saturday", acts: [
    { name: "Walkley Ukes", stage: "Main", start: "12:00", end: "12:40" },
    { name: "Rivelin Choir", stage: "Main", start: "13:15", end: "14:00" },
    { name: "Kelham Sound System", stage: "Main", start: "15:00", end: "16:15", billing: "support" as const },
    { name: "Attercliffe Sound", stage: "Main", start: "20:30", end: "22:00", billing: "headline" as const },
    { name: "Bakewell Tart", stage: "Barn", start: "14:30", end: "15:30" },
    { name: "The Don", stage: "Barn", start: "16:00", end: "17:00" },
    { name: "Hallam Folk", stage: "Barn", start: "20:45", end: "21:45" },
    { name: "Late Sound", stage: "Late", start: "22:30", end: "02:00" },
  ] },
  { day: "Sunday", acts: [
    { name: "Morning Chorus", stage: "Main", start: "11:00", end: "11:45" },
    { name: "Six Weirs Ceilidh", stage: "Barn", start: "13:00", end: "14:30" },
    { name: "Everyone, together", stage: "Main", start: "16:00", end: "17:00", billing: "headline" as const },
  ] },
];
function P() {
  return (
    <SiteChrome name="Loxley Weekender" tagline="Three days in a valley, first weekend of September."
      links={[{ label: "Home", href: "#/" }, { label: "Getting there", href: "#/info" }]}
      action={{ label: "Buy tickets", href: "#/" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The lineup" title="Forty-one acts, three stages"
          description="Clashes are marked. You cannot see everything and pretending otherwise helps nobody." />
        <LineupGrid className="mt-10" days={DAYS} />
        <div className="mt-14 border-t border-border pt-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <SafeImage src={null} alt="Main stage" ratio="4/3" />
            <SafeImage src={null} alt="The barn" ratio="4/3" />
            <SafeImage src={null} alt="The late tent" ratio="4/3" />
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Main is the field, Barn is the stone barn at the top (up a slope, bound-gravel path), and Late
            is the tent by the river which runs until two and is not quiet.
          </p>
        </div>
      </div>
    </SiteChrome>
  );
}
