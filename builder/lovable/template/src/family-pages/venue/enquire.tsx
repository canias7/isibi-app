// venue /enquire — the date, the numbers and the one form. The date box comes
// first and the contact form comes second, because somebody whose date is taken
// should find that out before they have typed their address in.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { DateEnquiry, type DateStatus } from "@/components/ui/date-enquiry";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/enquire")({ component: P });
const TAKEN = new Set(["2026-08-15", "2026-08-22", "2026-09-05", "2026-09-12"]);
function P() {
  const [status, setStatus] = React.useState<DateStatus | null>(null);
  const check = ({ date }: { date: string }) => {
    if (TAKEN.has(date)) return setStatus("taken");
    setStatus(date > "2027-06-30" ? "ask" : "free");
  };
  return (
    <SiteChrome name="Thrybergh Barn" tagline="A stone threshing barn for hire, ten minutes from Rotherham."
      links={[{ label: "Home", href: "#/" }, { label: "The spaces", href: "#/spaces" }]}
      action={{ label: "Check a date", href: "#top" }}>

      <div id="top" className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Enquire" title="Start with the date"
          description="Ask the date first. It takes a second, it is the answer you actually came for, and it means nobody fills in a form for a Saturday that went in January." />

        <div className="mt-10">
          <DateEnquiry status={status} minGuests={40} maxGuests={200}
            heading="Check a date and a headcount"
            alternatives={["2026-08-14", "2026-08-16", "2026-08-29"]}
            onCheck={check} onEnquire={() => {}} />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Then tell us about it" title="One form, and a person reads it"
                description="Kath answers these herself, usually within the day and never with a template. There is no automated sequence and nobody will ring you three times." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Useful to say</h2>
              <ul className="mt-3 space-y-2 text-base">
                <li className="border-b border-border pb-2">Roughly how many, even if it is a range</li>
                <li className="border-b border-border pb-2">Whether the ceremony is here or elsewhere</li>
                <li className="border-b border-border pb-2">Who is catering, if you already know</li>
                <li className="border-b border-border pb-2">Anything about access — we can solve most of it with notice</li>
                <li className="border-b border-border pb-2">Your budget. Saying it early saves everybody a viewing</li>
              </ul>

              <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">What happens after</h2>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
                <p>
                  We reply with the date confirmed or not, the figure for your day, and two or three
                  viewing times. Nothing is held until you ask.
                </p>
                <p>
                  A provisional hold is free and lasts fourteen days. If somebody else asks for the
                  same date in that fortnight we ring you first and you get 48 hours.
                </p>
                <p>
                  To confirm: a third up front, the rest six weeks before. No fee for changing the
                  date once, for any reason.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The figure" title="What a typical Saturday comes to"
            description="Our part is one number. This is what the whole day tends to cost with everything on it, so nobody is surprised at the third meeting." />
          <PriceList className="mt-6" items={[
            { name: "Venue hire, Saturday in season", price: 4200, description: "Noon to 1am, whole site, cleaning included. Ours, and the only figure we control." },
            { name: "Catering, typical", price: 62, meta: "Per head", description: "Three courses and staff, from the four caterers most people use here. You can use anybody." },
            { name: "Drinks", price: 0, meta: "Yours", description: "No corkage. Most people spend £14–22 a head buying it themselves." },
            { name: "Furniture", price: 0, meta: "Included", description: "Twenty round tables, sixteen trestles, 200 chairs. All here, all in the price." },
            { name: "Late licence to 3am", price: 400, description: "Optional. Covers the extra staffing, not a markup." },
            { name: "Marquee in the yard", price: 1400, meta: "From", description: "Only if you want the yard as a wet-weather plan. Anchors are already in the ground." },
          ]} />
          <p className="mt-4 text-sm text-muted-foreground">
            A hundred and twenty people, catered, with a bar you have stocked yourself and the late
            licence, tends to land between £11,000 and £14,000 all in. If that is not the number you
            had in mind, say so now rather than after a viewing.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Before you send it" />
            <Faq className="mt-6" items={[
              { question: "How far ahead do people book?", answer: "Saturdays in summer go about sixteen months out. Fridays, Sundays and midweek are often free inside six months, and they are the same building." },
              { question: "Can we see it with something set up?", answer: "Yes — we run four open days a year where the barn is laid for 120. Those are the ones worth coming to if you can wait for one." },
              { question: "Is a deposit refundable?", answer: "Up to six months before, yes, in full. After that it is not, which is why we would rather you took a free provisional hold and thought about it." },
              { question: "What if it rains?", answer: "The yard is the only outdoor space and everything else is under a roof. Nobody has ever had to move an event indoors at short notice, because indoors was always the plan." },
              { question: "Do you do a package?", answer: "No. Packages are how a venue makes a low headline figure add up, and they always contain something you do not want. You hire the building and buy the rest from whoever you like." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
