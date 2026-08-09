// medical /team — the practitioners and what each one does. The register
// number is on every card because it is the trust signal, and "what they treat"
// is written in the words a patient would use rather than in post-nominals.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { TriageBanner } from "@/components/ui/triage-banner";
export const Route = createFileRoute("/team")({ component: P });
function P() {
  return (
    <SiteChrome name="Rivelin Valley Medical Centre" tagline="An NHS GP practice on Walkley Lane, Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "Treatments", href: "/treatments" }]}
      action={{ label: "Register", href: "/" }}>

      <TriageBanner levels={[
        { when: "Chest pain, stroke signs, severe bleeding, or they will not wake up", action: "Call 999 now", tel: "999" },
        { when: "Urgent, not life-threatening, and we are closed", action: "Call NHS 111", tel: "111" },
      ]} />

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The team" title="Fourteen people, six of them doctors"
          description="Registration numbers are printed in full. They are public, they are checkable in about thirty seconds, and a practice that publishes them is telling you it expects to be checked." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Doctors</h2>
          <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <PractitionerCard name="Dr Amara Osei" role="GP Partner" letters="MBBS, MRCGP"
              register="GMC" registerNumber="4231907" registerUrl="#"
              treats={["long-term conditions", "diabetes", "women's health", "menopause"]}
              languages={["English", "Twi", "French"]}
              note="Here since 2011. Runs the Wednesday evening clinic." />
            <PractitionerCard name="Dr Tom Bramall" role="GP Partner" letters="MBChB, MRCGP, DRCOG"
              register="GMC" registerNumber="6018842" registerUrl="#"
              treats={["joints and backs", "sports injuries", "minor surgery", "men's health"]}
              note="Does the minor surgery list on Thursdays — moles, cysts, ingrowing toenails." />
            <PractitionerCard name="Dr Neil Fothergill" role="Salaried GP" letters="MBBS, MRCGP"
              register="GMC" registerNumber="7204415" registerUrl="#"
              treats={["mental health", "adolescents", "substance misuse"]}
              accepting={false}
              note="List full. Registered patients can still book with him." />
            <PractitionerCard name="Dr Sanne Vermeer" role="GP Registrar" letters="MBBS"
              register="GMC" registerNumber="7788901" registerUrl="#"
              treats={["everything a GP sees — she is a qualified doctor in her final training year"]}
              languages={["English", "Dutch"]}
              note="A registrar's appointments are longer, which some people prefer." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Nurses and pharmacist</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            For a lot of problems these are the right appointment and the faster one. Both nurse
            practitioners can prescribe.
          </p>
          <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <PractitionerCard name="Priya Raval" role="Nurse Practitioner" letters="RN, BSc, INP"
              register="NMC" registerNumber="18H2244E" registerUrl="#"
              treats={["asthma", "COPD", "wound care", "same-day illness"]}
              languages={["English", "Gujarati", "Hindi"]} />
            <PractitionerCard name="Kath Denby" role="Nurse Practitioner" letters="RN, INP"
              register="NMC" registerNumber="04B8871C" registerUrl="#"
              treats={["contraception", "cervical screening", "travel vaccines", "diabetes reviews"]} />
            <PractitionerCard name="Owen Hardcastle" role="Practice Pharmacist" letters="MPharm, IP"
              register="GPhC" registerNumber="2088341" registerUrl="#"
              treats={["medication reviews", "blood pressure", "anything about a prescription"]}
              note="Ring him rather than a GP if the question is about a tablet you are already on." />
            <PractitionerCard name="Marie Ogden" role="Healthcare Assistant" letters="NVQ3"
              treats={["blood tests", "blood pressure checks", "dressings", "flu jabs"]}
              note="No register for this role, so there is no number to print." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Behind the desk" title="Reception, admin and the managers"
            description="They are not clinicians and they are not gatekeepers either. If they ask what it is about, it is so you get the right appointment rather than the first one." />
          <TeamGrid className="mt-8" items={[
            { name: "Gill Naylor", role: "Practice Manager" },
            { name: "Rob Sisson", role: "Reception Lead" },
            { name: "Aneta Kowal", role: "Reception" },
            { name: "Dave Kilner", role: "Prescriptions" },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
