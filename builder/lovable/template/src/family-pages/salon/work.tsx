// salon /work — the finished sets. Nails are a visual trade: the
// gallery is what convinces, so it gets a page, and every third caption
// carries the price band so looking turns into booking.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/work")({ component: P });
const CHROME = {
  name: "Tenfold Nails", tagline: "Ten chairs on Ecclesall Road.",
  links: [{ label: "Home", href: "#/" }, { label: "The work", href: "#/work" }, { label: "Book", href: "#/book" }],
  action: { label: "Book now", href: "#/book" },
};
const SETS = [
  { tag: "BIAB", items: [
    { src: null, alt: "BIAB, milky pink, Mei" }, { src: null, alt: "BIAB with chrome tips, Sofia" },
    { src: null, alt: "Short round BIAB, natural" }] },
  { tag: "Art", items: [
    { src: null, alt: "Hand-painted florals, Mei" }, { src: null, alt: "Tortoiseshell, Amber" },
    { src: null, alt: "Matisse cutouts, Mei — two hours, worth it" }] },
  { tag: "Classic", items: [
    { src: null, alt: "Deep red, square" }, { src: null, alt: "French, thin line" },
    { src: null, alt: "Bare and glossy" }] },
];
function P() {
  const [tag, setTag] = useState<string | null>(null);
  const shown = tag ? SETS.filter((s) => s.tag === tag) : SETS;
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Recent sets</h1>
        <p className="mt-2 text-muted-foreground">All done in these chairs, all real customers. Screenshot the one you want and show it at your appointment — or just say "like the tortoiseshell".</p>
        <TagList className="mt-5" items={["BIAB", "Art", "Classic"]} active={tag} onSelect={setTag} />
        <div className="mt-6 grid gap-8">
          {shown.map((s) => (
            <section key={s.tag}>
              <h2 className="text-sm font-medium text-muted-foreground">{s.tag}</h2>
              <Gallery className="mt-2" columns={3} items={s.items} />
            </section>
          ))}
        </div>
        <p className="mt-10 rounded-xl border bg-muted/40 p-5 text-center text-sm">
          Art is priced by time on the day — the florals above were £12 on top of a gel set.{" "}
          <a className="font-medium underline underline-offset-4" href="#/book">Book the chair, bring the idea →</a>
        </p>
      </div>
    </SiteChrome>
  );
}
