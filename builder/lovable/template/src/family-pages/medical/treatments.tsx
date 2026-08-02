// medical /treatments — what is offered and what it costs. An NHS practice
// still has a private list (letters, medicals, travel jabs) and hiding it is
// what makes people ring up embarrassed. Prices in full, NHS marked as free.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TriageBanner } from "@/components/ui/triage-banner";
export const Route = createFileRoute("/treatments")({ component: P });
function P() {
  return (
    <SiteChrome name="Rivelin Valley Medical Centre" tagline="An NHS GP practice on Walkley Lane, Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "The team", href: "#/team" }]}
      action={{ label: "Register", href: "#/" }}>

      <TriageBanner levels={[
        { when: "Chest pain, stroke signs, severe bleeding, or they will not wake up", action: "Call 999 now", tel: "999" },
        { when: "Urgent, not life-threatening, and we are closed", action: "Call NHS 111", tel: "111" },
      ]} />

      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Treatments" title="What we do, and what it costs"
          description="Everything clinical is free on the NHS. The list below it is the paid work — letters, medicals and travel — which is not NHS work and never has been. The prices are the whole price." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">On the NHS — no charge</h2>
          <PriceList className="mt-4" items={[
            { name: "GP appointment", description: "Ten minutes, in person or by phone. Ask for a double if you have more than one thing.", price: "Free" },
            { name: "Nurse practitioner appointment", description: "Same-day illness, asthma, wounds. They can prescribe.", price: "Free" },
            { name: "Long-term condition review", description: "Diabetes, asthma, COPD, blood pressure. Once a year, we write to you.", price: "Free" },
            { name: "Contraception and sexual health", description: "Including coils and implants, fitted here on Tuesdays.", price: "Free" },
            { name: "Cervical screening", description: "Every three or five years depending on age. Booked with either nurse.", price: "Free" },
            { name: "Minor surgery", description: "Moles, cysts, ingrowing toenails. Referred internally after a GP look.", price: "Free" },
            { name: "Childhood immunisations", description: "The full schedule, plus catch-up for anybody who missed some.", price: "Free" },
            { name: "NHS Health Check", description: "Age 40–74, every five years. Forty minutes with a healthcare assistant.", price: "Free" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Not NHS work — these are charged</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            None of this is treatment and none of it is rationed — it is paperwork and travel medicine
            that the NHS does not pay a practice to do. Prices are set once a year by the partners.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Private sick note", description: "For the first seven days, when an employer insists.", price: 25, meta: "Same week" },
            { name: "Letter to a school, landlord or employer", description: "Factual only. We cannot write that somebody needs rehousing if we do not know that.", price: 40, meta: "Ten working days" },
            { name: "HGV, taxi or PSV medical", description: "Thirty minutes, eyesight test included. Bring your glasses and a urine sample.", price: 110, meta: "Booked appointment" },
            { name: "Fitness-to-travel letter", description: "For an airline. Not the same as travel insurance paperwork.", price: 45, meta: "Five working days" },
            { name: "Insurance report", description: "Priced by the insurer's own scale, not by us. We will tell you the figure before we start.", price: "Varies", meta: "Twenty working days" },
            { name: "Yellow fever vaccination", description: "We are a registered centre. Certificate issued on the day.", price: 78, meta: "Ten days before travel" },
            { name: "Rabies course", description: "Three doses over 21 days, so start early.", price: 195, meta: "Per course" },
            { name: "Japanese encephalitis", description: "Two doses, 28 days apart.", price: 205, meta: "Per course" },
          ]} />
          <p className="mt-4 text-sm text-muted-foreground">
            Fees are payable when you book, not when the letter is ready — that is what stopped us
            writing things nobody came back for. Ask before you book if the cost is a problem; we
            waive it more often than people expect.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="About the paid list" />
              <Faq className="mt-6" items={[
                { question: "Why is a sick note charged for?", answer: "The NHS pays us for the first seven days of self-certification not being needed. If your employer wants one anyway, that is a private arrangement between you and them and we are not funded for it." },
                { question: "Can I get travel vaccines on the NHS?", answer: "Some — typhoid, hepatitis A, tetanus and polio are free here. Yellow fever, rabies and Japanese encephalitis are not, anywhere in the country." },
                { question: "How long does an insurance report take?", answer: "Twenty working days, and the delay is almost never us. The insurer sends a form, we send it back, and they come back with more questions." },
                { question: "What if I cannot afford a fee?", answer: "Say so. We do not means-test and we do not ask for evidence — the receptionist can waive it and does." },
              ]} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Ask about something</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Admin questions only. Do not describe symptoms here — it is not a clinical route and
                nobody reads it out of hours.
              </p>
              <ContactForm className="mt-4" askPhone onSubmit={() => {}} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
