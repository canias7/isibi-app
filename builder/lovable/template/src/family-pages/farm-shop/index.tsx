// farm-shop — SEASON-FIRST: this week's box and what is in it. A farm shop's
// stock IS its marketing, and the calendar is the piece of content that does
// the most work: it tells somebody in February why there are no strawberries.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { ProduceCalendar } from "@/components/ui/produce-calendar";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const GROWN = [
  { name: "Potatoes", months: [7, 8, 9, 10], stored: [11, 12, 1, 2, 3], note: "Charlotte, then Maris Piper" },
  { name: "Carrots", months: [6, 7, 8, 9, 10, 11], stored: [12, 1, 2] },
  { name: "Onions", months: [8, 9], stored: [10, 11, 12, 1, 2, 3, 4] },
  { name: "Leeks", months: [10, 11, 12, 1, 2, 3] },
  { name: "Cabbage and kale", months: [9, 10, 11, 12, 1, 2, 3] },
  { name: "Purple sprouting", months: [2, 3, 4], note: "The best three weeks of the year" },
  { name: "Asparagus", months: [5, 6], note: "Six weeks and then it stops" },
  { name: "Broad beans", months: [6, 7] },
  { name: "Salad and rocket", months: [4, 5, 6, 7, 8, 9, 10] },
  { name: "Tomatoes", months: [7, 8, 9], note: "Polytunnel, so a month either side of outdoors" },
  { name: "Courgettes", months: [7, 8, 9] },
  { name: "Strawberries", months: [6, 7], note: "Three weeks if it is hot, six if it is not" },
  { name: "Raspberries", months: [7, 8, 9] },
  { name: "Apples", months: [9, 10, 11], stored: [12, 1, 2, 3] },
  { name: "Plums", months: [8, 9] },
  { name: "Rhubarb", months: [4, 5, 6], stored: [1, 2] },
];
function P() {
  return (
    <SiteChrome name="Hollin Busk Farm Shop" tagline="A working farm and shop above Stocksbridge, growing on eleven acres."
      links={[{ label: "The year", href: "#/season" }, { label: "Order a box", href: "#/order" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Order a box", href: "#/order" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Week beginning 3 August · eleven acres · no polytunnel heating</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">This week's box</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Everything below was pulled out of the ground on this farm within the last three
                days, except the two things marked. August is the easy month — come back in
                February and the list is shorter and more interesting.
              </p>
              <ul className="mt-7 divide-y divide-border border-y border-border text-base">
                {[
                  ["New potatoes", "Charlotte, dug Friday", "1.5kg"],
                  ["Carrots", "With the tops on", "500g"],
                  ["Courgettes", "Green and one yellow", "3"],
                  ["Tomatoes", "Polytunnel, ripe now", "500g"],
                  ["Salad", "Cut this morning", "A bag"],
                  ["Broad beans", "Last of them", "400g"],
                  ["Raspberries", "Picked Saturday", "A punnet"],
                  ["Onions", "Ours, from the barn", "3"],
                ].map(([what, note, qty]) => (
                  <li key={what} className="flex flex-wrap items-baseline gap-x-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{what}</span>
                      <span className="block text-sm text-muted-foreground">{note}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{qty}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Bananas and lemons in the shop are bought in and always have been. We will never
                pretend otherwise — it is on the shelf label as well as here.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="This week's box, packed" ratio="3/4" />
              <SafeImage src={null} alt="The top field in August" ratio="3/4" className="mt-10" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Boxes" title="Three sizes, one price all year"
          description="What is in it changes every week and the price does not. In August it is heavy on courgettes; in February it is roots and greens, and it is the same money." />
        <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <PriceList items={[
            { name: "Small box", price: 12, meta: "One or two people", description: "Six or seven things, about a week's vegetables for two who cook most nights." },
            { name: "Medium box", price: 18, meta: "The usual one", description: "Nine or ten things. Feeds a family of four if you are cooking from it properly." },
            { name: "Large box", price: 26, meta: "Four or more", description: "Everything in the medium plus more of it, and usually something we have too much of." },
          ]} />
          <PriceList items={[
            { name: "Add eggs", price: 3.2, meta: "Half dozen", description: "From the hens at the top of the lane. They stop laying properly in January and we say so rather than buying some in." },
            { name: "Add a loaf", price: 3.5, meta: "Wednesdays and Saturdays", description: "From Seven Hills in Sheffield, baked that morning. Not ours, and the label says so." },
            { name: "Add milk", price: 1.6, meta: "Two pints, glass", description: "From Hoyland, four miles away. Bring the bottle back and it is £1.30." },
            { name: "Delivery", price: 2, meta: "Within five miles", description: "Wednesdays and Fridays. Free on a large box, and free to the drop points either way." },
          ]} />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="The year" title="Why there are no strawberries in February"
            description="This is the single most useful thing on the site. Everything filled is picked here that month; everything outlined is ours but out of the barn rather than off the plant." />
          <ProduceCalendar className="mt-8" items={GROWN} now={new Date(2026, 7, 2)}
            caption="What we grow, and when" />
          <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="#/season">The year month by month, with what to cook →</a>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="The shop" title="Open six days, and it is a farm not a café" />
            <OpeningHours className="mt-6" days={[
              { day: 1, label: "Monday" },
              { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
              { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
              { day: 4, label: "Thursday", open: "09:00", close: "17:00" },
              { day: 5, label: "Friday", open: "09:00", close: "18:00" },
              { day: 6, label: "Saturday", open: "08:30", close: "16:00" },
              { day: 0, label: "Sunday", open: "10:00", close: "14:00" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Closed Mondays because that is when the beds get turned over. There is no café and
              there is not going to be one — the parking is for eleven cars and the lane is single
              track.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Testimonial item={{ quote: "The calendar on their site stopped me asking for things that don't exist yet. Now I plan the week around whatever is filled in for that month.", name: "Bea", role: "Medium box, weekly" }} />
              <Testimonial item={{ quote: "They tell you which two things in the box were bought in. Nobody else does that and it is the reason I trust the rest of it.", name: "Iwan", role: "Large box, fortnightly" }} />
            </div>
          </div>
          <div>
            <LocationCard name="Hollin Busk Farm Shop"
              address="Hollin Busk Lane, Bolsterstone, Sheffield, S36 1GW"
              note="Signposted off the Stocksbridge bypass. Single-track lane with passing places — take it slowly, there are tractors. Eleven parking spaces and level access to the shop." />
            <SafeImage className="mt-6" src={null} alt="The shop and the yard" ratio="4/3" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
