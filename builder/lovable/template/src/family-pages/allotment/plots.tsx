// allotment /plots — the sizes in SHED-AND-BED terms, and the site's real
// conditions.
//
// "250 SQUARE METRES" MEANS NOTHING TO ANYBODY. It is the figure every
// association publishes and it is the reason people take a full plot and give
// it back in September. Expressed as beds, a shed and a fruit cage, somebody
// can hold it against the garden they already have.
//
// AND THE CONDITIONS ARE THE OTHER HALF. Soil, aspect, altitude and water
// decide what will actually grow, and a site four hundred feet up on clay is a
// different proposition from a walled town plot. Publishing it stops somebody
// arriving with a seed catalogue written for Kent.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SizeGuide } from "@/components/ui/size-guide";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/plots")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Allotments"
      tagline="Three sizes, and the honest hours each one takes."
      links={[
        { label: "The wait", href: "#/" },
        { label: "The rules", href: "#/rules" },
      ]}
      action={{ label: "Join the waiting list", href: "#/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The plots</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Sizes are given as things you can picture rather than as square metres, because 250m² is
          the number every association publishes and it is why people take a full plot and hand it
          back in September.
        </p>

        <section className="mt-12">
          <SizeGuide
            caption="What each size actually holds"
            sizes={[
              {
                name: "Full plot",
                area: 250,
                areaLabel: "250m² · about 6 hours a week Apr–Sep",
                like: "Ten raised beds, a shed, a greenhouse, a fruit cage and a compost run — with room to walk between them.",
                alsoFits: ["A 20-tuber potato bed", "Six apple or plum trees", "Enough veg for a family of four, most of the year"],
                price: "£39 a year",
              },
              {
                name: "Half plot",
                area: 125,
                areaLabel: "125m² · about 3 hours a week Apr–Sep",
                like: "Five beds, a shed and a small fruit cage. This is the one to start with and almost everybody who did says so.",
                alsoFits: ["Salad, beans, courgettes and enough potatoes to matter", "A greenhouse if you skip the fruit"],
                price: "£20 a year",
              },
              {
                name: "Quarter plot",
                area: 60,
                areaLabel: "60m² · about 90 minutes a week Apr–Sep",
                like: "Three beds and a water butt. No shed — there is nowhere sensible to put one on a plot this size.",
                alsoFits: ["Salad and soft fruit", "A first year while you decide whether you like it"],
                price: "£10 a year · three exist",
              },
            ]}
          />
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The three quarter plots were made by splitting one full plot in 2021 and they are almost
            never free. If one comes up we offer it to whoever is nearest the top of the list who
            said they would take one.
          </p>
        </section>

        {/* THE CONDITIONS. What will and will not grow here. */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="The site"
            title="Four hundred feet up, on clay, facing north-east"
            description="Everything runs about a fortnight behind a Sheffield garden and roughly a month behind what a seed packet assumes. Worth knowing before you buy anything."
          />
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <SpecList>
              <SpecRow label="Altitude" value="128m" unit="above sea level" note="The last frost is usually mid-May and we have had one in June twice." />
              <SpecRow label="Aspect" value="North-east" note="The top twelve plots get sun until about four. The bottom row loses it at two in winter." />
              <SpecRow label="Soil" value="Heavy clay" highlight note="Waterlogged in February, brick in August. Everybody here raises beds eventually; do it in year one." />
              <SpecRow label="pH" value="6.2" note="Slightly acid. Lime the brassica bed, do not bother anywhere else." />
              <SpecRow label="Rainfall" value="880mm" unit="a year" note="Well above the Sheffield average. Blight is the annual argument and outdoor tomatoes rarely work." />
            </SpecList>
            <SpecList>
              <SpecRow label="Water" value="Twelve troughs" note="Mains-fed, on from March to October, off over winter. Included in the rent." />
              <SpecRow label="Hosepipes" value="Not allowed" highlight note="Watering cans from the trough. It is in the parish lease and it is not the committee's rule to bend." />
              <SpecRow label="Electricity" value="None" note="A quote came in at £41,000 in 2022 and the members voted it down twice. There is not going to be any." />
              <SpecRow label="Parking" value="Nine spaces" note="At the top gate. Full on a Saturday in May; the lane has no passing places, so do not block it." />
              <SpecRow label="Access" value="Gated, coded" note="Code changes each October. The top path is surfaced; the lower paths are grass and are a mudbath in winter." />
            </SpecList>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What comes with it"
            title="Shared things, and what is yours to sort out"
            description="A lot of associations are vague about this and people arrive assuming a rotavator and a delivery of manure."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Shared, included</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>Water from the troughs, March to October.</li>
                <li>A petrol rotavator and a strimmer, booked in the shed diary.</li>
                <li>A muck delivery each October, split between whoever wants it.</li>
                <li>The trading hut — seed, compost, canes and netting at about two thirds of shop price. Saturdays, 10 till 12.</li>
                <li>Two communal compost bays and a woodchip pile.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Yours</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>A shed, if you want one. Second-hand ones change hands here constantly for £30 or nothing.</li>
                <li>Tools. Everybody lends, and do not leave anything you would miss.</li>
                <li>Getting the plot into shape in year one — we strim it before you start and that is where our help ends.</li>
                <li>Insurance for your own shed and contents. The association covers public liability and nothing of yours.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Questions about the plots" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I choose which plot?",
                  answer:
                    "You get offered what is free. If two are free you can pick, and you can turn one down twice before going to the back of the list. Nobody has ever been offered a plot and told to take it or leave.",
                },
                {
                  question: "Can I move to a bigger one later?",
                  answer:
                    "Yes, and about four people a year do. Ask the secretary — you go on a short internal list, which is much faster than the main one. Moving down is just as easy and it is not a failure.",
                },
                {
                  question: "Is there a greenhouse allowed?",
                  answer:
                    "On a full or half plot, up to 8ft by 10ft, and polycarbonate rather than glass — the wind up here breaks glass and then there is glass in the soil forever. It needs a form, which takes a week.",
                },
                {
                  question: "What is the clay actually like?",
                  answer:
                    "Hard work for two years and then good. Raised beds, muck every autumn and never dig it wet. The people with the best plots here all did the same three things and none of them are clever.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The wait, and joining the list</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/rules">The tenancy in plain words</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
