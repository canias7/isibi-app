// restaurant/tap-list — BAR AND BREWERY. Same family, same one-page scroll, and
// the hero is replaced: what is pouring RIGHT NOW leads, in dense rows, because
// a taproom's list turns over every few days and a photograph of the room
// answers the wrong question. The menu-first version leads with the room; this
// one leads with the board, because a bar's regulars are checking the board.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { Marquee } from "@/components/ui/marquee";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TapList } from "@/components/ui/tap-list";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "16:00", close: "23:00" },
  { day: 3, label: "Wednesday", open: "16:00", close: "23:00" },
  { day: 4, label: "Thursday", open: "16:00", close: "23:00" },
  { day: 5, label: "Friday", open: "12:00", close: "00:00" },
  { day: 6, label: "Saturday", open: "12:00", close: "00:00" },
  { day: 0, label: "Sunday", open: "12:00", close: "22:00" },
];
const OPEN = HOURS.filter((h) => h.open && h.close).map((h) => ({ day: h.day, open: h.open!, close: h.close! }));
function P() {
  return (
    <SiteChrome name="The Wire Mill" tagline="Ten lines and a cask engine, on Mowbray Street."
      links={[{ label: "What's on", href: "#tap" }, { label: "Food", href: "#food" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Find us", href: "#find-us" }}>

      {/* THE BOARD, FIRST AND WHOLE. The menu-first version of this family puts
          the room in the hero; a taproom's list changes every few days and its
          regulars are checking whether the stout is back on. Nothing above it. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Mowbray Street · ten lines and a cask engine</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">On now</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <OpenNow hours={OPEN} />
              <span className="text-sm text-muted-foreground">Board updated Sunday 15:40</span>
            </div>
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            <TapList pours={[
              { tap: 1, name: "Mowbray Pale", style: "Pale ale", abv: 4.2, price: "£4.60", serve: "Pint", note: "Ours. On permanently and the only one that is" },
              { tap: 2, name: "Hollin Busk Bitter", style: "Best bitter", abv: 3.8, price: "£4.20", serve: "Pint", note: "Cask, on the engine. Sunday it will be a different one" },
              { tap: 3, name: "Kelham Pils", style: "Pilsner", abv: 4.8, price: "£5.10", serve: "Pint" },
              { tap: 4, name: "Neepsend Session IPA", style: "Session IPA", abv: 4.4, price: "£5.00", serve: "Pint" },
              { tap: 5, name: "Abbeydale Voyager", style: "IPA", abv: 6.2, price: "£3.40", serve: "Two thirds", note: "Two thirds only above 6%, which is not us being awkward" },
              { tap: 6, name: "Loxley Stout", style: "Oatmeal stout", abv: 5.1, price: "£5.20", serve: "Pint", note: "Back on Thursday after four weeks off" },
              { tap: 7, name: "Rivelin Weisse", style: "Hefeweizen", abv: 5.4, price: "£5.40", serve: "Pint" },
              { tap: 8, name: "Sour of the week", style: "Gose", abv: 4.0, price: "£3.20", serve: "Two thirds", note: "Rhubarb this week. It is properly sour" },
              { tap: 9, name: "Something dark and silly", style: "Imperial stout", abv: 9.4, price: "£4.80", serve: "Third", off: true, note: "Blew Saturday night. Nothing on this line until Friday" },
              { tap: 10, name: "Cider — Broadoak medium", style: "Cider", abv: 4.5, price: "£4.60", serve: "Pint" },
            ]} />
            <div className="flex flex-col gap-6">
              <SafeImage src={null} alt="The bar and the ten lines" ratio="4/3" />
              <div className="rounded-lg border border-border bg-muted/40 p-5">
                <p className="text-base font-medium">Thirds, halves and two-thirds on everything</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Priced pro rata, not rounded up. A third of the 9.4% is £2.40, which is exactly a
                  third of the pint price, and nobody will look at you oddly for ordering one.
                </p>
              </div>
              <div className="rounded-lg border border-border p-5">
                <p className="text-base font-medium">A line that has blown says so</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Struck through rather than removed. Somebody walking down for the imperial stout
                  should find out here rather than at the bar, and "back Friday" is more use than
                  a gap where it used to be.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/50 py-3">
        <Marquee speed={38} items={[
          "Ten keg, one cask, and the cask changes every three days",
          "Thirds on everything, priced pro rata",
          "Dogs yes, all of them, all the time",
          "No TVs and no music after ten",
          "Takeaway cans and growler fills at the bar",
          "Card only after nine — the safe is on a timer",
        ].map((t) => <span key={t} className="text-sm text-muted-foreground">{t}</span>)} />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <StatsBand items={[
          { value: "10", label: "Keg lines, plus one cask" },
          { value: "£4.20", label: "Cheapest pint, and it is a good one" },
          { value: "3 days", label: "Average time a line lasts" },
          { value: "2018", label: "Opened, in a wire drawer's yard" },
        ]} />
      </section>

      <section id="food" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Food" title="Toasties and a pie, and that is deliberate"
            description="A taproom that tries to be a restaurant ends up being neither. Six things, all of them good, none of them after nine." />
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
            <MenuSection groups={[
              { name: "Until 21:00", items: [
                { name: "Cheese and onion toastie", price: 6.5, description: "Ogleshield, and far too much of it" },
                { name: "Ham hock and mustard toastie", price: 7, description: "The hock comes from the butcher on Gibraltar Street" },
                { name: "Pie of the day", price: 9.5, description: "Chalked up. Always one vegetarian, always one that is not" },
                { name: "Scotch egg", price: 4.5, description: "Made two streets away and still the best thing on this list" },
                { name: "Bowl of chips", price: 4, description: "Beef dripping unless you say otherwise" },
                { name: "Board of cheese", price: 12, description: "Three, from the shop on Sharrow Vale, with chutney and too much bread" },
              ] },
              { name: "Takeaway", note: "Cans, bottles and growler fills at the bar", items: [
                { name: "Growler fill, 2 pints", price: 9, description: "Bring your own or buy one for £6" },
                { name: "Can of Mowbray Pale, 440ml", price: 4.2, meta: "4 for £15" },
                { name: "Mixed four-pack, our choice", price: 17, description: "Whatever is going well that week" },
              ] },
            ]} />
            <div className="flex flex-col gap-6">
              <SafeImage src={null} alt="The pie, chalked up on Thursday" ratio="4/3" />
              <Testimonial item={{ quote: "Ten lines and not one of them is a lager anybody has heard of, which is the entire point of the place.", name: "Priya Sanghera", role: "Every other Friday" }} />
              <SafeImage src={null} alt="The cask engine" ratio="4/3" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The room" title="A wire drawer's yard, and it looks it" />
        <Gallery className="mt-10" columns={3} items={[
          { alt: "The bar from the door", caption: "Ten lines, left to right" },
          { alt: "The board above the bar", caption: "Chalked, and rewritten most days" },
          { alt: "The yard in summer", caption: "Twelve tables and a lot of dogs" },
          { alt: "The cask engine", caption: "One handpull, changed every three days" },
          { alt: "The back room", caption: "Bookable for nothing, used by everybody" },
          { alt: "Cans on the takeaway shelf", caption: "Fills and cans until we shut" },
        ]} />
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="Mowbray Street, past the bridge" />
              <LocationCard className="mt-6" name="The Wire Mill" address="41 Mowbray Street, Sheffield, S3 8EN"
                note="Ten minutes' walk from the station along the river. Shalesmoor tram stop is four minutes. No car park and we would rather you did not bring one." />
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
              <OpeningHours className="mt-5" days={HOURS} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Shut Mondays and we are not going to change that. Last orders is twenty past, and
                the yard closes at ten because of the flats behind.
              </p>
            </div>
            <SafeImage src={null} alt="The frontage on Mowbray Street" ratio="4/5" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <CtaBand title="The board changes faster than this page"
          description="It is updated most days and it was last touched on Sunday afternoon. If something matters, ring — somebody is always behind the bar."
          action={{ label: "Ring 0114 272 4410", href: "tel:01142724410" }} />
      </section>
    </SiteChrome>
  );
}
