// pharmacy /services — what can be treated here without a GP, and which are
// free.
//
// PHARMACY FIRST IS THE BIGGEST CHANGE TO PRIMARY CARE IN A DECADE AND ALMOST
// NOBODY KNOWS ABOUT IT. Seven conditions, antibiotics included, free, no
// appointment — and the average person still rings a surgery at eight in the
// morning for a sore throat. Naming all seven with what each visit involves is
// the whole content.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CounterServices } from "@/components/ui/counter-services";
import { TriageBanner } from "@/components/ui/triage-banner";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/services")({ component: P });

const FIRST = [
  { what: "Sore throat", who: "5 years and over", detail: "We score it against the FeverPAIN criteria. Most sore throats need no antibiotic and we will say so; where one is needed you leave with it." },
  { what: "Earache", who: "1 to 17 years", detail: "The commonest reason a child is taken to a GP out of hours. Bring them in instead — it takes ten minutes." },
  { what: "Sinusitis", who: "12 years and over", detail: "Usually needs time rather than antibiotics, and we can supply the thing that actually helps in the meantime." },
  { what: "Impetigo", who: "1 year and over", detail: "Cream, usually, same visit. Very common in nurseries in the summer." },
  { what: "Shingles", who: "18 and over", detail: "Antiviral treatment works best inside 72 hours of the rash appearing, so come the same day rather than waiting for an appointment." },
  { what: "Infected insect bites", who: "1 year and over", detail: "The distinction between an ordinary reaction and an infection is exactly the sort of thing to come in about." },
  { what: "Uncomplicated urinary infection", who: "Women 16 to 64", detail: "Assessed and treated here, same visit. Men, and women outside that band, we refer — the guidance is narrow and we follow it." },
];

const OTHER = [
  { what: "Blood pressure check", price: "Free", hours: "Any time we are open", detail: "Over 40, no appointment. Two readings and a 24-hour monitor if the first is high. About one in eight is referred on." },
  { what: "Flu vaccination", price: "Free if eligible, £18 otherwise", hours: "September to January", detail: "Walk in. Eligible means over 65, pregnant, a carer, or with one of a list of conditions — ask, because most people who qualify assume they do not." },
  { what: "COVID vaccination", price: "Free if eligible", hours: "Autumn and spring campaigns" },
  { what: "Travel vaccinations and antimalarials", price: "£30 – £95 depending", hours: "Thursdays, by appointment", detail: "Book six weeks out. Some courses need three visits over a month and people routinely leave it two weeks." },
  { what: "Emergency contraception", price: "Free under 25, £28 otherwise", hours: "Whenever the pharmacist is in", detail: "Consultation room, no appointment. Sooner is more effective — do not wait for a convenient moment." },
  { what: "Stop smoking support", price: "Free", hours: "Weekly, twelve weeks", detail: "Including the medication. Three times more likely to work than willpower alone, which is not a slogan but the actual figure." },
  { what: "Medicine review", price: "Free", hours: "By appointment", detail: "For anybody on four or more regular medicines. Half an hour going through all of it, and we write to your GP with anything that should change." },
  { what: "Substance misuse services", price: "Free", hours: "Daily", detail: "Supervised consumption and needle exchange. Discreet, in the consultation room, and we do not make anybody wait in the shop." },
  { what: "Sharps and medicine disposal", price: "Free", detail: "Anything at all, including controlled drugs. No forms and no questions, ever." },
  { what: "Photo printing and passport photos", stopped: true, detail: "Stopped in 2023. The machine broke and replacing it was not worth it — the Post Office two doors down does both." },
];

function P() {
  return (
    <SiteChrome
      name="Walkley Pharmacy"
      tagline="Seven conditions treated here without a GP, and everything else we do."
      links={[
        { label: "Home", href: "/" },
        { label: "Repeat prescriptions", href: "/repeat" },
      ]}
      action={{ label: "Order a repeat", href: "/repeat" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Services</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The biggest change to primary care in a decade happened quietly and almost nobody knows
          about it. We can now assess and treat seven conditions here — including supplying
          antibiotics — free, with no appointment and no GP involved.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Pharmacy First"
            title="Seven conditions, free, walk in"
            description="Ten to fifteen minutes in the consultation room. If it turns out to need a GP we book that for you rather than sending you back to the phone at eight in the morning."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {FIRST.map((f) => (
              <li key={f.what} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-medium">{f.what}</p>
                  <p className="text-sm text-muted-foreground">{f.who}</p>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We will not supply an antibiotic that is not needed, and roughly half of these
            consultations end without one. That is the point of the scheme rather than a limitation
            of it.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Everything else"
            title="Ten more, and one we stopped"
            description="The stopped one is still listed. People come in for it and deserve to be told where it went rather than to find a gap on a shelf."
          />
          <div className="mt-8">
            <CounterServices
              services={OTHER}
              heading="What else we do"
              note="Anything marked free is free to you. Ask about eligibility rather than assuming — most people who qualify for a free flu jab do not know they do."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Not us" title="When to go somewhere else" />
          <div className="mt-8">
            <TriageBanner
              heading="We would rather send you than keep you"
              levels={[
                { when: "Chest pain, breathlessness, a suspected stroke", action: "999, immediately", tel: "999" },
                { when: "A child under one with a fever, or who is floppy or very drowsy", action: "111, or A&E if you are worried", tel: "111", note: "We will not assess a baby under one and no pharmacy should." },
                { when: "An eye injury or sudden loss of vision", action: "Hallamshire eye casualty, directly", note: "Royal Hallamshire Hospital, Glossop Road. Walk in, no referral needed." },
                { when: "A dental problem", action: "111 for the emergency dental service", tel: "111", note: "We can give painkillers and nothing more. Antibiotics do not fix toothache and we will not supply them for it." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Service questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do I need to be registered with a local GP?",
                  answer: "For Pharmacy First, no — we can see anybody. We do send a record to your GP afterwards if you have one, which is a good thing rather than a catch.",
                },
                {
                  question: "How long is the wait?",
                  answer: "Usually under fifteen minutes and rarely more than half an hour. Mondays and the hour after five are the busiest.",
                },
                {
                  question: "Will you tell my GP?",
                  answer:
                    "For a Pharmacy First consultation, yes — it goes on your record the same day, which matters if the problem comes back. Anything you buy over the counter does not.",
                },
                {
                  question: "Can somebody collect for me?",
                  answer:
                    "Yes, with your name and address. For controlled drugs they will need ID. We can also add a regular person to your record so it is never a discussion.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The four doors</a>
            {" · "}
            <a className="underline underline-offset-4" href="/repeat">Repeat prescriptions</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
