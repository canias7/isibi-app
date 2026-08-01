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
import { SiteChrome } from "@/components/ui/site-chrome";

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
    // SiteChrome carries the header, the footer, the single <main> and the skip
    // link, so EVERY page of the site has them and no page writes them twice.
    // `nav` is a node rather than a list of props because <Link to> is typed
    // against the routes that exist — passing strings would need a cast, and the
    // cast throws away the check that catches a link to a page nobody built.
    <SiteChrome
      name="Cutler Row"
      address="14 Cutler Row, Sheffield S1"
      phone="0114 270 0000"
      nav={
        <>
          <Link to="/">Home</Link>
          <Link to="/book">Book</Link>
          <Link to="/account">Account</Link>
        </>
      }
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight">
          Barbering on Cutler Row since 2014
        </h1>
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
      </div>
    </SiteChrome>
  );
}
