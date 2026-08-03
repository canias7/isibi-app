// cleaner /book — property size, frequency, first date. The frequency picker
// repeats because the price depends on the size of the house, so the number on
// the home page and the number here are not the same number.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  return (
    <SiteChrome name="Rivelin Home Clean" tagline="Domestic cleaning in west Sheffield. Eleven cleaners, all employed."
      links={[{ label: "Home", href: "#/" }, { label: "Where we go", href: "#/areas" }]}
      action={{ label: "Book a clean", href: "#form" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Book" title="Pick a size, then how often"
          description="Every price on this page is the whole price. No call-out charge, no VAT to add, no first-visit surcharge and no minimum term." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">One or two bedrooms</h2>
          <FrequencyPicker className="mt-3" onBook={() => {}} options={[
            { label: "Every week", perYear: 52, pricePerVisit: 36, duration: "1.5 hours", suggested: true },
            { label: "Every two weeks", perYear: 26, pricePerVisit: 42, duration: "2 hours" },
            { label: "Once a month", perYear: 12, pricePerVisit: 58, duration: "2.5 hours" },
            { label: "One-off", perYear: 0, pricePerVisit: 110, duration: "4 hours" },
          ]} />
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Three bedrooms</h2>
          <FrequencyPicker className="mt-3" onBook={() => {}} options={[
            { label: "Every week", perYear: 52, pricePerVisit: 48, duration: "2 hours", suggested: true },
            { label: "Every two weeks", perYear: 26, pricePerVisit: 56, duration: "2.5 hours" },
            { label: "Once a month", perYear: 12, pricePerVisit: 78, duration: "3.5 hours" },
            { label: "One-off", perYear: 0, pricePerVisit: 145, duration: "5 hours" },
          ]} />
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Four bedrooms or more</h2>
          <FrequencyPicker className="mt-3" onBook={() => {}} options={[
            { label: "Every week", perYear: 52, pricePerVisit: 62, duration: "2.5 hours", suggested: true },
            { label: "Every two weeks", perYear: 26, pricePerVisit: 74, duration: "3 hours" },
            { label: "Once a month", perYear: 12, pricePerVisit: 104, duration: "4.5 hours" },
            { label: "One-off", perYear: 0, pricePerVisit: 190, duration: "6.5 hours" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Extras" title="On top, and only if you ask"
                description="These are the jobs that take a whole visit on their own, so they are booked separately rather than squeezed into a regular one." />
              <PriceList className="mt-6" items={[
                { name: "Inside the oven", price: 45, meta: "Or free every third visit", description: "A proper strip-down with the shelves out. On a regular slot it is included every third visit at no charge." },
                { name: "Inside the windows", price: 30, meta: "Whole house", description: "Included every third visit on a weekly or fortnightly slot. Outsides are a window cleaner's job and we will recommend one." },
                { name: "Ironing", price: 22, meta: "Per hour", description: "Booked as extra time rather than squeezed in. About an hour for a family's week." },
                { name: "Inside kitchen cupboards", price: 40, meta: "Emptied and washed", description: "Once a year is plenty. Best booked when you are in, so you can throw things out as we go." },
                { name: "End of tenancy", price: 220, meta: "From, 3-bed", description: "The full checklist a letting agent works from, including the oven and the windows. Priced after a look at photographs." },
                { name: "After building work", price: 0, meta: "Quoted", description: "Dust gets everywhere and no two are alike, so it is always quoted rather than listed." },
              ]} />
            </div>
            <div id="form">
              <SectionHeader eyebrow="Get started" title="Tell us where and how often"
                description="Chrissy reads these. She will come round for ten minutes first, free, so you can meet whoever would be coming and agree the list." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
              <h3 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">How it starts</h3>
              <Steps className="mt-4" columns={1} items={[
                { title: "A ten-minute visit", description: "Chrissy comes round, looks at the house, and agrees the list with you. Free, no obligation." },
                { title: "You meet your cleaner", description: "Before the first visit, not on the day. If it is not a fit, say so and we send somebody else." },
                { title: "The slot is yours", description: "Same person, same day, same time. First visit is often longer and we tell you before, not after." },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About booking" />
            <Faq className="mt-6" items={[
              { question: "How soon can you start?", answer: "Two to three weeks for a weekly slot, sooner for fortnightly. Tuesdays and Wednesdays free up fastest; everybody wants a Friday." },
              { question: "Is the first visit more expensive?", answer: "It is usually longer, and we tell you how much longer before we come rather than putting it on the bill afterwards. Typically an extra hour on a house that has not been done for a while." },
              { question: "How do I pay?", answer: "Standing order monthly, on the 1st, for the number shown on the card above. It is the same every month whichever way the weeks fall." },
              { question: "What if I want to change frequency?", answer: "Any time, a week's notice, no charge. Going from fortnightly to weekly is usually the easier direction because the slot already exists." },
              { question: "Do you do offices?", answer: "A few small ones, out of hours. Ring rather than using this form — it is priced differently and it needs a look." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
