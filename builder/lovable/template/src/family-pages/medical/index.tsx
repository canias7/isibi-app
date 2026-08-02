// medical — REGISTER-FIRST: the urgent instruction sits above everything,
// including the practice's own name in the eye's reading order, because the
// person who needs it is not browsing. Nothing decorative goes above it. Then
// how to register, which is the only other thing a new patient wants.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
import { TriageBanner } from "@/components/ui/triage-banner";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Rivelin Valley Medical Centre" tagline="An NHS GP practice on Walkley Lane, Sheffield."
      links={[{ label: "The team", href: "#/team" }, { label: "Treatments", href: "#/treatments" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Register", href: "#register" }}>

      {/* FIRST IN THE DOM, before the hero. This is the whole family: a person
          having a stroke at nine at night must not scroll past a photograph of
          a reception desk to find out to ring 999. */}
      <TriageBanner levels={[
        { when: "Chest pain, stroke signs, severe bleeding, or they will not wake up", action: "Call 999 now", tel: "999", note: "Do not drive them yourself" },
        { when: "It is urgent but not life-threatening, and we are closed", action: "Call NHS 111", tel: "111", note: "Open all night, every night" },
        { when: "You need us today and we are open", action: "Call 0114 234 8800", tel: "01142348800", note: "Lines open 08:00. On-the-day appointments go quickly" },
      ]} />

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Walkley Lane · 7,400 patients · accepting new registrations</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Rivelin Valley Medical Centre</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Six GPs, two nurse practitioners and a pharmacist. We take patients from the whole
                S6 postcode and part of S10 — if you are not sure, ring and ask rather than guessing.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#register">Register with us</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/team">Who you would see</a>
              </div>
            </div>
            <OpeningHours days={[
              { day: 1, label: "Monday", open: "08:00", close: "18:30" },
              { day: 2, label: "Tuesday", open: "08:00", close: "18:30" },
              { day: 3, label: "Wednesday", open: "08:00", close: "20:00" },
              { day: 4, label: "Thursday", open: "08:00", close: "18:30" },
              { day: 5, label: "Friday", open: "08:00", close: "18:30" },
              { day: 6, label: "Saturday", open: "09:00", close: "12:00" },
              { day: 0, label: "Sunday" },
            ]} />
          </div>
        </div>
      </section>

      <section id="register" className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Registering" title="It takes about ten minutes"
            description="You do not need proof of address, and you do not need to be a British citizen. Anybody can refuse to give either and still register — that is the rule, not a favour." />
          <Steps className="mt-8" items={[
            { title: "Fill in the form", description: "Online or on paper at reception. There is a second form about your health which you can bring back later." },
            { title: "We ask your old surgery", description: "Your records follow you. It takes a couple of weeks and you can be seen before they arrive." },
            { title: "Book a health check", description: "With a nurse, in the first month. Not compulsory, but it is how we find the things nobody mentions." },
          ]} />
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/treatments">Start the form</a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">Come in and collect one</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="The team" title="Who you would actually see"
            description="Every registration number here is on a public register and we would rather you checked." />
          <a className="text-sm font-medium underline underline-offset-4" href="#/team">All fourteen of us →</a>
        </div>
        <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
          <PractitionerCard name="Dr Amara Osei" role="GP Partner" letters="MBBS, MRCGP"
            register="GMC" registerNumber="4231907" registerUrl="#"
            treats={["long-term conditions", "diabetes", "women's health", "menopause"]}
            languages={["English", "Twi", "French"]} />
          <PractitionerCard name="Dr Tom Bramall" role="GP Partner" letters="MBChB, MRCGP, DRCOG"
            register="GMC" registerNumber="6018842" registerUrl="#"
            treats={["joints and backs", "sports injuries", "minor surgery", "men's health"]} />
          <PractitionerCard name="Priya Raval" role="Nurse Practitioner" letters="RN, BSc, INP"
            register="NMC" registerNumber="18H2244E" registerUrl="#"
            treats={["asthma", "COPD", "wound care", "same-day illness"]}
            languages={["English", "Gujarati", "Hindi"]}
            note="Can prescribe, so a nurse appointment is often the faster one." />
          <PractitionerCard name="Dr Neil Fothergill" role="Salaried GP" letters="MBBS, MRCGP"
            register="GMC" registerNumber="7204415" registerUrl="#"
            treats={["mental health", "adolescents", "substance misuse"]}
            accepting={false}
            note="Full list. He still sees registered patients — this only affects new registrations naming him." />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="The questions reception answers all day" />
              <Faq className="mt-6" items={[
                { question: "How do I get an appointment on the day?", answer: "Ring at eight or use the online form from seven. Both go into the same list — the phone is not faster, and the form means you are not on hold." },
                { question: "Can I ask for a particular doctor?", answer: "Yes, for anything that is not urgent. For a same-day problem you get whoever is on, which is usually a nurse practitioner and usually quicker." },
                { question: "Do I need proof of address to register?", answer: "No. We may ask, and you may decline, and we still have to register you. Nobody is turned away for want of a bank statement." },
                { question: "How do I get a repeat prescription?", answer: "Through the NHS App, on paper at reception, or your pharmacy can request it. Allow two working days — not two days, two working days." },
              ]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The waiting room, which has a window" ratio="3/4" />
              <SafeImage src={null} alt="The treatment room" ratio="3/4" className="mt-10" />
            </div>
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="Walkley Lane" />
            <LocationCard className="mt-6" name="Rivelin Valley Medical Centre"
              address="212 Walkley Lane, Sheffield, S6 2PL"
              note="Level access from the car park, six disabled bays, and a hearing loop at reception. The 95 and the 52 both stop outside." />
          </div>
          <SafeImage src={null} alt="The building from Walkley Lane" ratio="16/9" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <CtaBand title="Not registered anywhere?"
          description="You are entitled to a GP whether or not you have an address, an ID document or a settled immigration status. Come in and we will do it with you."
          action={{ label: "Register with us", href: "#register" }} />
      </section>
    </SiteChrome>
  );
}
