import { createFileRoute } from "@tanstack/react-router";

import { SITE_QRS } from "@/site-brand";
import { CtaBand } from "@/components/ui/cta-band";
import { Figure } from "@/components/ui/figure";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/visit")({
  head: () => ({
    meta: [
      { title: "Visit — Harbour Loaf" },
      { property: "og:title", content: "Visit — Harbour Loaf" },
      {
        name: "description",
        content: "Opening hours and how to find the bakery in Bristol.",
      },
      {
        property: "og:description",
        content: "Opening hours and how to find the bakery in Bristol.",
      },
    ],
  }),
  component: Visit,
});

const CHROME = {
  name: "Harbour Loaf",
  tagline: "A neighbourhood sourdough bakery in Bristol.",
  links: [
    { label: "Today's bake", href: "/" },
    { label: "The starter", href: "/starter" },
    { label: "Visit", href: "/visit" },
  ],
  action: { label: "Order a loaf", href: "/order" },
  contact: {
    address: "Bristol",
    hours: "Wed–Sat 8–2, Sun 9–1",
  },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: null, close: null },
  { day: 3, label: "Wednesday", open: "08:00", close: "14:00" },
  { day: 4, label: "Thursday", open: "08:00", close: "14:00" },
  { day: 5, label: "Friday", open: "08:00", close: "14:00" },
  { day: 6, label: "Saturday", open: "08:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

function Visit() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Come to the bakery</h1>
        <SectionHeader
          className="mt-8"
          eyebrow="Visit"
          title="The shutters and the street"
          description="Walk in for whatever is left on the board, or order a collection and we will hold a loaf."
        />

        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <div>
            <OpenNow
              hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                day: h.day,
                open: h.open!,
                close: h.close!,
              }))}
            />
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <OpeningHours days={HOURS} />
              {SITE_QRS.gallery ? (
                <Figure caption={SITE_QRS.gallery.label}>
                  <img
                    src={SITE_QRS.gallery.src}
                    alt={SITE_QRS.gallery.label}
                    className="size-[160px]"
                  />
                </Figure>
              ) : null}
            </div>
          </div>
          <div>
            <SafeImage
              src="/u/fold-lane-bakery/d5d591527a2bed3836f73b5e74e75565.jpg"
              alt="The counter and morning board at Harbour Loaf"
              ratio="4/3"
              fallbackSeed="counter"
            />
            <LocationCard
              className="mt-4"
              name="Harbour Loaf"
              address="Bristol"
              note="On a side street a few minutes from the water. Look for the flour-dusted window and the morning board."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20 motion-reveal">
        <CtaBand
          title="Order a collection so we hold a loaf"
          description="Walk-ins are welcome for whatever is left. A collection order keeps your name on a loaf."
          action={{ label: "Order a loaf", href: "/order" }}
        />
      </section>
    </SiteChrome>
  );
}
