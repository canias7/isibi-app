// Reference page — THE HOME PAGE, laid out the way the TRADE lays one out.
//
// A generated site is not a generic landing page wearing a business's name. A
// barber shop has conventions, and following them is most of what reads as
// "somebody who knows this trade made this":
//
//   - The PRICE LIST IS A MENU — rows with the price on the right — never a
//     grid of product cards. `PriceList`'s own comment calls it the most common
//     shape on a site this platform builds.
//   - PEOPLE BOOK A BARBER, not a shop, so the team gets a section. The
//     pictures are the owner's to add later; `TeamGrid` guards them.
//   - The GALLERY is the work. It is the shop's portfolio, not decoration.
//   - HOURS, ADDRESS AND PHONE LIVE TOGETHER in one "Find us" section, because
//     they answer one question. Hours floating alone answer half of it.
//
// AND THE BUTTONS SIT WHERE THE DECISION HAPPENS. "Book" is in the header on
// every page, in the hero, on EVERY ROW of the price list, and once more at the
// bottom. The per-row button carries its service into the form —
// `/book?service=Skin fade` — so the form opens half-filled. "Call" is beside
// "Book" in the hero as a real tel: link, because for a barber shop the phone
// IS a booking channel.
//
// The rhythm is BANDS: full-bleed hero, then sections alternating between the
// page colour and `bg-muted`, each with its own inner container. A page where
// every section is `mt-14` inside one narrow column reads as a document.
//
// THE PAGES ARE WIRED TOGETHER — owner's call. One chrome navigates between
// them, the price rows carry their service into /book, the form hands back the
// claim link /manage opens, and the member pages sit behind the real session,
// so the site WORKS the day it is generated. What stays written into the page
// is the owner's own facts — hours, the team, the gallery captions — and that
// is a data decision, not a wiring one: those cost no query and cannot render
// empty on a fresh site.
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { Hero } from "@/components/ui/hero";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return. The phone is a nav link because for this trade it is a
// booking channel, not small print.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Prices", href: "#prices" },
    { label: "The barbers", href: "#barbers" },
    { label: "Find us", href: "#find-us" },
    { label: "0114 270 0000", href: "tel:+441142700000" },
  ],
  action: { label: "Book a chair", href: "#/book" },
};

// The shop's own facts. Anything the owner will never edit from a form belongs
// in the page — it costs no query and cannot be empty on a fresh site.
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "18:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "18:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "20:00" },
  { day: 5, label: "Friday", open: "09:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "17:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

function Home() {
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Barbering on Cutler Row since 2014"
        subtitle="Six barbers, no appointment needed on weekdays. Walk in before eleven, or book a chair."
        primary={{ label: "Book a chair", href: "#/book" }}
        secondary={{ label: "Call 0114 270 0000", href: "tel:+441142700000" }}
      />

      {/* Reassurance in the trade's own language, not a corporate stats band. */}
      <section className="mx-auto max-w-5xl px-6">
        <TrustStrip
          items={[
            { title: "Walk-ins welcome", description: "Before 11 on weekdays you won't wait long" },
            {
              title: "4.9 on Google",
              description: "Two hundred odd reviews, mostly about the fades",
            },
            { title: "Cash or card", description: "No booking fee, no deposit" },
          ]}
        />
      </section>

      <section id="prices" className="mt-4 border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <SectionHeader
            eyebrow="The price list"
            title="Cuts and shaves"
            description="Every cut finishes with a hot towel. Students £4 off, Tuesday to Thursday."
          />
          {/* A price list is ROWS — name, price on the right, a Book button on
              the row — because that is how the trade writes one. `PriceList`
              takes the whole list at once, so the query's states sit around it;
              when a page lays rows out itself, `DataList` carries all four
              states instead. */}
          {services.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
          {services.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the price list. Refresh and try again.
            </p>
          )}
          {services.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">Nothing listed yet.</p>
          )}
          {!!services.data?.length && (
            <PriceList
              className="mt-6"
              items={services.data.map((s) => ({
                name: s.name,
                description: s.description,
                price: s.price,
                meta: s.duration_minutes != null ? `${s.duration_minutes} min` : null,
              }))}
              /* THE BUTTON IN THE RIGHT PLACE: the row you are reading is the
                 service you want, so its Book button carries the service into
                 the form. The search param is typed by /book's own
                 validateSearch, so a typo here fails the build. */
              action={{
                label: "Book",
                onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
              }}
            />
          )}
        </div>
      </section>

      <section id="barbers" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The barbers"
          title="Pick your chair"
          description="Six of us, two generations. Ask for whoever cut you last — it's on your booking."
        />
        {/* People book a person. Photos are the owner's to add after the build,
            so every one is guarded by the component. */}
        <TeamGrid
          className="mt-8"
          items={[
            { name: "Tommy Vasile", role: "Owner — fades and razor work" },
            { name: "Marcus Obeng", role: "Beards and hot towel shaves" },
            { name: "Ellis Ward", role: "Scissor cuts" },
            { name: "Deniz Aydın", role: "Kids and first cuts" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20 motion-reveal">
          <SectionHeader eyebrow="The work" title="Recent cuts" />
          <Gallery
            className="mt-8"
            columns={3}
            items={[
              { src: null, alt: "Skin fade, front window chair" },
              { src: null, alt: "Beard line-up" },
              { src: null, alt: "Scissor crop" },
              { src: null, alt: "Hot towel shave" },
              { src: null, alt: "The long window on a Saturday" },
              { src: null, alt: "Tommy's chair" },
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader eyebrow="Kind words" title="What the chairs say" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote:
                "Been coming since they opened. Never waited more than ten minutes, never had a bad cut.",
              name: "Dan Whitfield",
              role: "Every third Thursday",
            }}
          />
          <Testimonial
            item={{
              quote: "Took my lad for his first proper cut. Deniz had him laughing the whole time.",
              name: "Priya Nair",
              role: "Saturday regular",
            }}
          />
        </div>
      </section>

      {/* Hours, address and phone are ONE question — how do I get there and
          when — so they are one section, with the live answer on top. */}
      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On the row itself" />
            <OpenNow
              className="mt-6"
              hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                day: h.day,
                open: h.open!,
                close: h.close!,
              }))}
            />
            <OpeningHours days={HOURS} className="mt-4" />
          </div>
          <LocationCard
            className="self-start"
            name="Cutler Row Barbers"
            address="14 Cutler Row, Sheffield S1 2AY"
            note="Two minutes from the Cathedral tram stop. No parking on the row itself — use Campo Lane."
          />
        </div>
      </section>

      {/* The last thing before the footer is the thing you want them to do. */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <CtaBand
          title="A chair is usually free the same day"
          description="Book in thirty seconds. We'll call to confirm."
          action={{ label: "Book a chair", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
