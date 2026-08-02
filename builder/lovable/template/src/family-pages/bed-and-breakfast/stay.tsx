// bed-and-breakfast /stay — breakfast, arrival, parking and the rules. The
// practical half, plus the direct comparison repeated, because this is the page
// somebody is on when they decide whether to open the platform's tab again.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { BusyButton } from "@/components/ui/busy-button";
import { DirectSaving } from "@/components/ui/direct-saving";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { HouseRules } from "@/components/ui/house-rules";
import { Input } from "@/components/ui/input";
import { MenuSection } from "@/components/ui/menu-section";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/stay")({ component: P });
const NIGHTS = [
  { date: "2026-08-01", rate: 110 }, { date: "2026-08-02", rate: 98 },
  { date: "2026-08-03", rate: 98 }, { date: "2026-08-04", rate: 98 },
  { date: "2026-08-05", rate: 98 }, { date: "2026-08-06", rate: 98 },
  { date: "2026-08-07", rate: 110 }, { date: "2026-08-08", taken: true },
  { date: "2026-08-09", rate: 98 }, { date: "2026-08-10", rate: 98 },
  { date: "2026-08-11", rate: 98 }, { date: "2026-08-12", rate: 98 },
  { date: "2026-08-13", rate: 98 }, { date: "2026-08-14", rate: 110 },
  { date: "2026-08-15", taken: true }, { date: "2026-08-16", rate: 98 },
  { date: "2026-08-17", rate: 98 }, { date: "2026-08-18", rate: 98 },
  { date: "2026-08-19", rate: 98 }, { date: "2026-08-20", rate: 98 },
  { date: "2026-08-21", rate: 110 }, { date: "2026-08-22", taken: true },
  { date: "2026-08-23", rate: 98 }, { date: "2026-08-24", rate: 98 },
  { date: "2026-08-25", rate: 98 }, { date: "2026-08-26", rate: 98 },
  { date: "2026-08-27", rate: 98 }, { date: "2026-08-28", rate: 110 },
  { date: "2026-08-29", taken: true }, { date: "2026-08-30", taken: true },
  { date: "2026-08-31", rate: 110 },
];
function P() {
  const [month, setMonth] = React.useState("2026-08");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [dates, setDates] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Thurgoland House" tagline="Four rooms above the Don valley. Breakfast until nine, and later if you ask."
      links={[{ label: "Home", href: "#/" }, { label: "The rooms", href: "#/rooms" }]}
      action={{ label: "Ring 01226 763 118", href: "tel:01226763118" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Staying here" title="Breakfast, arrival, and the two rules"
          description="The practical half, on one page, so nothing turns up as a surprise in a confirmation email at eleven at night." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Free nights, the Blue Room</h2>
            <AvailabilityCalendar className="mt-3" nights={NIGHTS} month={month} onMonth={setMonth}
              now={new Date(2026, 7, 2)}
              priceNote="The price on each night is the Blue Room for two people, breakfast included. One person is £20 less." />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Struck through means that room is taken, not the house. Ring and we will tell you what
              else is free that night — there are four rooms and this shows one of them.
            </p>
            <HouseRules className="mt-8" rules={[
              { what: "Dogs in the Garden Room only", firm: true, detail: "One dog, £10 for the stay. Not in the breakfast room — that is a food hygiene rule and not something we can bend for a well-behaved spaniel." },
              { what: "No smoking anywhere inside", firm: true, detail: "There is a bench and an ashtray by the back door and nobody minds at all." },
              { what: "Quiet after eleven", firm: false, detail: "It is an old house with wooden floors and four bedrooms off one landing. Everybody works it out within an hour." },
              { what: "Tell us about anything you cannot eat", firm: false, detail: "At booking rather than at the table. Gluten, dairy, vegan, whatever — it is a domestic kitchen and it is easy with notice and awkward without." },
            ]}
              arrive="16:00 – 20:00" leave="10:30"
              lateNote="Later than eight, or earlier than four? Both are usually fine — ring and say. There is a key safe for genuinely late arrivals and we will give you the code rather than sit up." />
          </div>
          <div>
            <DirectSaving platform="Booking.com" platformPrice={132} ourPrice={115}
              checked="28 July" nights="Garden Room, two people, Friday 14 August, one night"
              instead="What direct does buy is a person on the phone, a late arrival sorted out in one call, and a cancellation that does not need a form." />

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Breakfast</h2>
            <MenuSection className="mt-3" groups={[{ name: "07:30 – 09:00, cooked to order", items: [
              { name: "The full one", description: "Sausage from the butcher in Penistone, dry-cured bacon, black pudding if you want it, eggs from the farm up the lane" },
              { name: "Eggs, any way", description: "Poached, scrambled, fried. On sourdough from the Holmfirth bakery" },
              { name: "Smoked haddock and a poached egg", description: "Wednesdays and weekends, when the fish comes" },
              { name: "Porridge, properly made", description: "With cream and whisky if that is the sort of morning it is" },
              { name: "Fruit, yoghurt and granola", description: "The granola is made here and people ask for the recipe" },
              { name: "Vegetarian and vegan full", description: "Not an afterthought — say when you book and it is as good as the other one" },
            ] }]} />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Earlier than half seven if you have a train, and later than nine at a weekend if you
              would rather. Neither is a problem and neither costs anything; the only thing we
              genuinely cannot do is all four rooms at eight o'clock on the dot.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Book it" title="An email, and we reply the same day" />
              {sent ? (
                <SuccessPanel className="mt-6" title="Got it — we'll come back today"
                  description="Nothing is taken and nothing is held until we have both said yes. If it is for tonight, ring instead; the phone is much faster." />
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="b-name" required>
                      <Input id="b-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Email" htmlFor="b-email" required>
                      <Input id="b-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Nights, room and how many of you" htmlFor="b-dates" required
                    hint="And anything you cannot eat — it is much easier with notice.">
                    <Textarea id="b-dates" rows={5}
                      placeholder={"14–16 August, two of us, Garden Room if it's free.\nOne of us is coeliac.\nArriving about half seven on the Friday."}
                      value={dates} onChange={(e) => setDates(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !email || !dates} onClick={() => setSent(true)}>
                    Ask about these nights
                  </BusyButton>
                  <p className="text-sm text-muted-foreground">
                    No card, no deposit, no booking fee. We hold rooms on an email and it has worked
                    for eleven years.
                  </p>
                </div>
              )}
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="The practical questions" />
              <Faq className="mt-6" items={[
                { question: "Where do we park?", answer: "On the gravel, off the road, five spaces for four rooms. No permit, no charge, and you can leave the car here if you are walking from the door." },
                { question: "Can we get in during the day?", answer: "Yes — you get a key and the house is yours. The sitting room has a fire in winter and there is always cake." },
                { question: "What if our train is late?", answer: "Ring. There is a key safe and we will give you the code. Nobody has ever arrived too late to get in." },
                { question: "Do you charge for children?", answer: "A cot is free. A child in the Attic is £15 including breakfast. We do not charge adult rates to eleven-year-olds." },
                { question: "Is there anywhere to eat nearby?", answer: "The Bridge in the village, six minutes on foot, proper food until eight thirty. We will book you a table at breakfast — they hold two for us most nights." },
                { question: "How far is the station?", answer: "Penistone is four miles and there is a lift at eight in the morning if you want it. A taxi is about £11 and we will ring one." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
