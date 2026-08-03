// gym/in-stock-near-you /location — one shop's own page, and the retail change
// is that it leads with what is IN it rather than with what it is. A branch
// page for a gym describes the equipment; a shop's has to answer "is it worth
// the drive today", which is a stock question and changes hourly.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { StockLevel } from "@/components/ui/stock-level";
import { BRANCHES } from "./index";
export const Route = createFileRoute("/location")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "09:00", close: "17:30" },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:30" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:30" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:30" },
  { day: 5, label: "Friday", open: "09:00", close: "17:30" },
  { day: 6, label: "Saturday", open: "09:00", close: "17:00" },
  { day: 0, label: "Sunday", open: "10:00", close: "16:00" },
];
const OPEN = HOURS.filter((h) => h.open && h.close).map((h) => ({ day: h.day, open: h.open!, close: h.close! }));
const HERE = [
  { name: "Hario V60 hand grinder", stock: 3, price: 68 },
  { name: "Comandante C40", stock: 1, price: 245 },
  { name: "V60 dripper, 02, ceramic", stock: 22, price: 24 },
  { name: "Aeropress", stock: 0, price: 34 },
  { name: "Chemex, 6 cup", stock: 4, price: 52 },
  { name: "Acaia Pearl scales", stock: 2, price: 195 },
];
function P() {
  const b = BRANCHES[0];
  const others = BRANCHES.filter((x) => x.key !== b.key);
  return (
    <SiteChrome name="Foundry Coffee" tagline="Four shops in Sheffield. Beans roasted on Alma Street since 2012."
      links={[{ label: "All four shops", href: "#/" }, { label: "Subscriptions", href: "#/memberships" }]}
      action={{ label: "Ring 0114 272 8800", href: "tel:01142728800" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← All four shops</a>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Alma Street · the roastery · since 2012</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">Kelham Island</h1>
          </div>
          <OpenNow hours={OPEN} />
        </div>

        {/* WHAT IS IN IT, FIRST. A gym's branch page describes the equipment;
            a shop's has to answer "is it worth the drive today", and that is a
            stock question rather than a description. */}
        <section className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="On the shelf here, right now" title="Six of the things people ring about"
              description="From the till system, refreshed every fifteen minutes. A zero is a zero rather than a blank — and the Aeropress is genuinely out, with a van on Thursday." />
            <div className="mt-6">
              <PriceList items={HERE.map((h) => ({
                name: h.name,
                price: h.price,
                meta: h.stock > 0 ? `${h.stock} here` : "None here — Thursday",
                description: h.stock === 0 ? "Out at this shop. Crystal Peaks has nine and Heeley has two." : undefined,
              }))} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Beans, always</p>
                <div className="mt-2">
                  <StockLevel count={40} lowAt={8} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Roasted here on Tuesdays and Fridays. There has never been a day this shop had no
                  beans and there is not going to be one.
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Grinding, free</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Any bag, any grind, while you wait. Bring a bag from anywhere else and we will
                  grind that too — it takes forty seconds and it is not worth charging for.
                </p>
              </div>
            </div>
          </div>

          <div>
            <LocationCard name="Foundry Coffee — Kelham Island" address={b.address}
              note={`${b.parking}. The roastery is behind the shop and you can see into it. Step-free from Alma Street, and the counter has a lowered end.`} />
            <div className="mt-6">
              <OpeningHours days={HOURS} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Roasting Tuesday and Friday mornings, which is when the shop smells best and is also
              when it is loudest. Cupping at eleven on the first Saturday of the month, free, no
              booking, about twelve people.
            </p>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">If we have not got it, the others might</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {others.map((o) => (
                  <li key={o.key}>
                    <span className="font-medium text-foreground">{o.name}</span> · {o.distance} ·{" "}
                    <a className="underline underline-offset-4" href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Ring them directly rather than us — they can see their own shelf and we cannot.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The shop" title="A cutlery works, and it still has the crucible" />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "The shop front on Alma Street", caption: "Alma Street" },
            { alt: "The roaster, mid-batch", caption: "Roasting, Tuesday morning" },
            { alt: "The equipment wall", caption: "Everything is out of the box to handle" },
            { alt: "The bean shelf", caption: "Eight origins, four blends" },
            { alt: "The counter", caption: "Grinding is free and takes forty seconds" },
            { alt: "The cupping table", caption: "First Saturday, eleven o'clock" },
            { alt: "The back of the roastery", caption: "You can see into it from the shop" },
            { alt: "Alma Street parking", caption: "Two hours free outside" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About this shop" />
            <Faq className="mt-6" items={[
              { question: "How accurate are the stock numbers?", answer: "They come off the tills every fifteen minutes. They are right almost always and wrong occasionally, when something is behind the counter waiting for somebody who reserved it. Ring if you are driving more than twenty minutes." },
              { question: "Will you hold something for me?", answer: "24 hours, free, by phone. We will not take a reservation through the website, because a click cannot tell whether somebody is stood at the counter buying the last one." },
              { question: "Can I try before I buy?", answer: "Any grinder, any brewer, on the counter, with real coffee. The Comandante and the Hario side by side takes five minutes and settles it for most people." },
              { question: "Do you price match?", answer: "Against a UK shop that has it in stock, yes. Not against a marketplace listing from an account with no address — half of those are grey imports with no warranty here." },
              { question: "Is there parking?", answer: "Two hours free on Alma Street, and it is rarely full before ten. The Kelham Island car park is two minutes and £2." },
              { question: "What is the cupping?", answer: "First Saturday, eleven, free, about twelve people. We taste whatever came in that month, including the ones we decided not to buy — which is the more interesting half." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
