// salon/call-now — A MOBILE HAIRDRESSER. The base family's hero is the slot
// picker, and for ten chairs on a high street that is exactly right: the
// question is which of today's gaps you want.
//
// A service that comes to YOU cannot answer that question from a grid, because
// the slot depends on things the grid does not know — where you are, whether
// there is a sink, whether there are stairs, whether the appointment is for
// somebody who needs longer. Every one of those is a sentence on the phone and
// a form field somebody abandons. And this clientele — care homes, people
// after surgery, new mothers, the housebound — rings. So the phone number IS
// the booking surface, at the size a booking surface gets, and the form below
// it is the fallback for people who would rather not.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { KeyPoints } from "@/components/ui/key-points";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TravelTimeNote } from "@/components/ui/travel-time-note";
import { TrustStrip } from "@/components/ui/trust-strip";
import { WorkingHours } from "@/components/ui/working-hours";
export const Route = createFileRoute("/")({ component: P });
export const AREAS = [
  "Hessle", "Anlaby", "Willerby", "Kirk Ella", "Cottingham", "Beverley",
  "Swanland", "North Ferriby", "Brough", "Elloughton", "Walkington", "Molescroft",
];
function P() {
  return (
    <SiteChrome name="Hair at Home" tagline="Wendy Frayne. Cutting in kitchens across the East Riding since 2004."
      links={[{ label: "Or use the form", href: "#/book" }, { label: "Your appointment", href: "#/manage" }, { label: "What I can do at home", href: "#/work" }]}
      action={{ label: "Ring 07700 900 812", href: "tel:07700900812" }}>

      {/* THE PHONE IS THE BOOKING SURFACE. Not a link in a header above a
          form — the thing at the top of the page, at the size the slot picker
          would have been, because it is doing the slot picker's job. */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              I come to you · East Riding and west Hull · 22 years
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-balance">
              Ring me and we will sort it out in two minutes.
            </h1>
            <a href="tel:07700900812"
              className="mt-6 block rounded-lg border border-foreground bg-primary px-6 py-5 text-center text-primary-foreground">
              <span className="block text-xs font-medium uppercase tracking-[0.18em] opacity-80">Wendy, direct</span>
              <span className="mt-1 block text-4xl font-semibold tracking-tight tabular-nums">07700 900 812</span>
              <span className="mt-1 block text-sm opacity-80">I answer it myself. If I am mid-cut it goes to voicemail and I ring back the same day.</span>
            </a>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              There is no slot picker on this page on purpose. Half of what decides an appointment
              is where you are, whether there is a sink I can use, whether there are stairs, and
              how long it needs to take — and those are four sentences on the phone or eleven
              fields on a form nobody finishes.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Would rather not ring? <a className="font-medium text-foreground underline underline-offset-4" href="#/book">The form asks the same things</a> and
              I reply by text within a few hours. It is a fallback and I mean that kindly — the
              phone is genuinely faster for both of us.
            </p>
          </div>
          <div>
            <SafeImage src={null} alt="Wendy cutting at a kitchen table in Hessle" ratio="4/3" />
            <div className="mt-5">
              {/* 0 = Sunday, like Date#getDay. */}
              <WorkingHours week={[
                [],
                [{ open: "09:00", close: "17:00" }],
                [{ open: "09:00", close: "17:00" }],
                [{ open: "09:00", close: "17:00" }],
                [{ open: "09:00", close: "19:30" }],
                [{ open: "09:00", close: "17:00" }],
                [{ open: "09:00", close: "13:00" }],
              ]} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Thursday runs late for people who work. Ring any time in those hours — outside them
              leave a message rather than a text, because a text at half past nine gets read at
              half past nine and I would rather not wake anybody up replying.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <StatsBand items={[
          { value: "22 yrs", label: "Doing this, all of it mobile" },
          { value: "12", label: "Villages and suburbs covered" },
          { value: "£26", label: "A cut, at your kitchen table" },
          { value: "0", label: "Booking fees, card fees or travel charges inside the area" },
        ]} />

        <section className="mt-14 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Where" title="Twelve places, and no travel charge in any of them"
              description="Type where you are. If you are just outside I will usually still come — it depends on the day rather than the mileage, which is another thing a form cannot tell you and I can." />
            <div className="mt-6 max-w-md">
              <ServiceArea areas={AREAS} placeholder="Hessle, HU13, Beverley…"
                note="Anywhere else, ring and ask. I go to Market Weighton on a Tuesday and to Hornsea about once a month, and if you are on either run there is no charge for that either." />
            </div>
            <div className="mt-6 max-w-md">
              <TravelTimeNote minutes={18} mode="drive" hedge="Usually about"
                note="From Hessle to the far side of Beverley. It is why the last appointment of a day is often in the same village as the one before it, and why I will sometimes ask if a different day suits you." />
            </div>
            <div className="mt-8">
              <TrustStrip columns={2} items={[
                { title: "Fully insured", description: "Public liability through the NHF, certificate on request" },
                { title: "DBS checked", description: "Enhanced, 2024. I work in care homes and people ask — quite rightly" },
                { title: "NVQ Level 3", description: "Hairdressing, Hull College, 2003. Still doing training two days a year" },
                { title: "I bring everything", description: "Chair cape, clippers, my own towels, and a mat for the floor" },
              ]} />
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="What it costs" title="The same price whoever you are and wherever you are"
              description="No peak pricing, no charge for coming to you, and no surcharge for a wheelchair, a bed or a care home. Cash, card or bank transfer — the card machine works everywhere except two of the villages." />
            <div className="mt-6">
              {/* PriceList's action is an onSelect, not a link — so the row
                  the reader tapped is what places the call, and the number is
                  the same one at the top of the page. */}
              <PriceList
                action={{ label: "Ring to book", onSelect: () => { window.location.href = "tel:07700900812"; } }}
                items={[
                  { name: "Dry cut", price: 26, meta: "45 min", description: "Cut and finish at your table. No wash needed" },
                  { name: "Cut and blow dry", price: 34, meta: "1 hr", description: "Needs a sink I can reach — a kitchen one is fine and usually better" },
                  { name: "Gentlemen's cut", price: 18, meta: "30 min", description: "Clippers and scissors. Beard trim £6 with it" },
                  { name: "Restyle", price: 46, meta: "1 hr 15", description: "Bring a picture. We will talk about it before anything is cut" },
                  { name: "Colour, roots", price: 58, meta: "1 hr 45", description: "Includes the patch test, done 48 hours before, which I come out for and do not charge for" },
                  { name: "Full head colour", price: 82, meta: "2 hr 30", description: "Same patch test. This one needs a proper sink" },
                  { name: "Perm", price: 74, meta: "2 hr", description: "Still ask for it, still do it, still good at it" },
                  { name: "Care home visit", price: 16, meta: "per resident", description: "Four or more on the same visit. I invoice the home monthly" },
                ]} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A colour needs a patch test 48 hours before — that is not a policy I made up, it is
              the insurance and it is also just sensible. I come out and do it, it takes four
              minutes and it is free, and the reason it is on this page is that people are
              surprised by it and it means a colour is never a same-day job.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Who rings" title="Mostly four kinds of people" />
              <div className="mt-6">
                <KeyPoints title="And every one of them for the same reason" points={[
                  "Somebody who cannot easily get out — after an operation, or for good.",
                  "A care home, where I do four to nine residents in a morning.",
                  "A new mother, in the eight weeks where leaving the house is the hard part.",
                  "Somebody who simply hates salons, and there are far more of these than anybody admits.",
                ]} />
              </div>
              <div className="mt-6">
                <Testimonial item={{
                  quote: "Mum has dementia and a salon is forty minutes of distress before anybody picks up a comb. Wendy comes to the flat, talks to her for ten minutes first, and it is the calmest hour of the fortnight.",
                  name: "Judith Hallgarth", role: "Anlaby, four years",
                }} />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you ring, if you like" />
              <Faq className="mt-6" items={[
                { question: "What do you need from me?", answer: "A chair, a plug within reach, and about a square metre of floor I can put a mat on. That is genuinely it — I bring towels, cape, clippers and a mirror." },
                { question: "Do I need a special sink?", answer: "For a wash, a kitchen sink you can lean back over is best and a bathroom one is usually workable. For a dry cut, nothing at all. If you are not sure, ring and describe it and I will tell you in ten seconds." },
                { question: "Can you come to a care home?", answer: "Yes, and about a third of my week is care homes. Four residents or more on one visit is £16 each and I invoice the home rather than the families. Ring the number and ask for me by name." },
                { question: "What if there are stairs?", answer: "Not a problem, and I would still like to know before I arrive so I can leave the heavy bag in the car. This is the sort of thing the phone sorts out and a booking form does not think to ask." },
                { question: "How far ahead do I need to book?", answer: "About a fortnight for a Thursday evening or a Saturday, and often the same week for a weekday morning. If something has come up and you need it sooner, ring anyway — I have a cancellation more weeks than not." },
                { question: "Do you take card?", answer: "Yes, and cash, and bank transfer. The card machine needs a signal and there are two spots in Walkington where it does not have one, in which case we sort it out afterwards and it has never once been a problem." },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="rounded-lg border border-border bg-muted/50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-lg font-semibold">Still the fastest thing on this page</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Two minutes on the phone and it is booked, including the four things I need to
                  know that no form has thought to ask you.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-6 py-3 text-base font-semibold tabular-nums text-primary-foreground" href="tel:07700900812">07700 900 812</a>
                <a className="rounded-md border border-border px-6 py-3 text-base font-medium" href="#/book">Use the form instead</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
