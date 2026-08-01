// Reference page — THE HOME PAGE. Hand-written against the schema the designer
// actually produced for "a small barber shop site": services(name, description,
// price, duration_minutes, image_url) and appointments(...), plus opening hours
// the owner fills in.
//
// This exists to be imitated. It is the shape the generator should emit, and it
// is deliberately a SITE rather than a page: header, navigation, content,
// footer, and a link to the booking page. Read with useRows, never write fetch
// code, and reach for a composition from @/components/ui before building one out
// of Card and div — every list state below is one component, not four blocks.
//
// The booking FORM lives on book.tsx, because that is where a real site puts it
// and because a home page that is mostly a form is the thing every generated
// site used to be.
import { createFileRoute, Link } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  image_url: string | null;
};

// Opening hours are the shop's own facts, not a table. Anything the owner will
// never edit from a form belongs in the page, where it costs no query.
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Cutler Row</span>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#services" className="text-muted-foreground hover:text-foreground">Services</a>
            <a href="#hours" className="text-muted-foreground hover:text-foreground">Hours</a>
            {/* Between PAGES it is <Link to>, never <a href> — an anchor reloads
                the whole app and loses the router. Within a page, a hash anchor
                is right and a Link is not. */}
            <Link to="/book" className="font-medium">Book</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight">Barbering on Cutler Row since 2014</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Walk in before eleven, or book a chair. Six barbers, no appointment needed on weekdays.
        </p>
        <div className="mt-6 flex gap-3">
          {/* asChild hands the button's styling to the Link, so it is a real
              navigation rather than a button with an onClick that pushes. */}
          <Button asChild className="motion-press">
            <Link to="/book">Book a chair</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="#services">See the price list</a>
          </Button>
        </div>

        <section id="services" className="mt-14">
          <h2 className="text-xl font-medium">Services</h2>
          {/* DataList carries the loading skeleton, the error sentence, the empty
              state and the rows. Writing those four by hand on every list of
              every page is the single most repeated mistake in a generated site,
              and getting one wrong is invisible until a visitor hits it. */}
          <DataList
            query={services}
            className="mt-4 grid gap-3 motion-stagger sm:grid-cols-2"
            skeletonClassName="h-40 rounded-xl"
            empty={{ title: "Nothing listed yet", description: "The price list is on its way." }}
            error="Couldn't load the services. Refresh and try again."
          >
            {(s) => (
              <Card key={s.id} className="motion-lift overflow-hidden">
                {/* A picture column holds a URL the OWNER fills in after the
                    build, so it is empty on a fresh site. SafeImage renders the
                    fallback instead of a broken-image icon — which is why no
                    page here needs its own `{s.image_url && ...}` guard. */}
                <SafeImage src={s.image_url} alt={s.name} ratio="16/9" />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-baseline justify-between text-base">
                    <span>{s.name}</span>
                    {s.price != null && <span className="tabular-nums">£{s.price}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {s.description}
                  {s.duration_minutes != null && (
                    <span className="mt-1 block tabular-nums">{s.duration_minutes} min</span>
                  )}
                </CardContent>
              </Card>
            )}
          </DataList>
        </section>

        <section id="hours" className="mt-14 motion-reveal">
          <h2 className="text-xl font-medium">Opening hours</h2>
          <OpeningHours days={HOURS} className="mt-4 max-w-sm" />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground">
          <span>14 Cutler Row, Sheffield S1</span>
          <a href="tel:+441142700000" className="hover:text-foreground">0114 270 0000</a>
        </div>
      </footer>
    </div>
  );
}
