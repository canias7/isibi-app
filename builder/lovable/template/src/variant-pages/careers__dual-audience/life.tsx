// careers/dual-audience /life — the culture page, and in a staffing variant
// "life" is not our office. Nobody chooses a recruitment agency because its
// team does a Friday quiz. Both audiences want the same thing here — evidence
// that we know this trade — so it is the method, the numbers behind it, and
// what happens when it goes wrong.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
import { TeamGrid } from "@/components/ui/team-grid";
import { TestimonialGrid } from "@/components/ui/testimonial";
export const Route = createFileRoute("/life")({ component: P });
function P() {
  return (
    <SiteChrome name="Attercliffe Recruitment" tagline="Engineering and manufacturing recruitment across South Yorkshire since 2004."
      links={[{ label: "All roles", href: "#/#roles" }, { label: "For employers", href: "#/#hiring" }]}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="How we work" title="Nobody picks an agency for its Friday quiz"
          description="So this is not a page about our office. Both sides want the same evidence — that we understand the trade, that the numbers are real, and that we say what happens when it goes wrong." />

        <StatsBand className="mt-10" items={[
          { value: "22 days", label: "Median instruction to accepted offer" },
          { value: "89%", label: "Placements still there at 12 months" },
          { value: "1 in 3", label: "Roles we decline, mostly on salary" },
          { value: "2004", label: "Same four people, same two miles" },
        ]} />

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="The method" title="It starts with standing on the floor"
                description="Which sounds like a slogan and is a scheduling decision — it costs half a day per role and it is the reason a third of them get declined." />
              <Steps className="mt-6" items={[
                { title: "A visit before an advert", description: "We see the machine, the shift pattern and the car park. You cannot write an honest advert from a job description emailed over." },
                { title: "The salary conversation, first", description: "If it is £5k under the market we say so on that visit. Six weeks of failing to fill a role bills nobody and wastes everybody." },
                { title: "Three to five people, with reservations attached", description: "In writing, including what we are unsure about. A shortlist with no doubts on it is a shortlist somebody has not read." },
              ]} />
              <div className="mt-8 rounded-lg border border-border bg-muted/50 p-6">
                <p className="text-base font-medium">What happens when we get it wrong</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Eleven per cent of placements are not there at a year, and about a third of those
                  leave in the first twelve weeks. The rebate covers that in money — 100% inside four
                  weeks, 50% to eight, 25% to twelve — and we ring the candidate as well as the
                  client, because half the time the reason is something we could have found out on
                  the visit and did not.
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <SafeImage src={null} alt="A client's shop floor in Rotherham" ratio="4/3" />
              <SafeImage src={null} alt="The office on Attercliffe Road" ratio="4/3" />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Who" title="Four people, and all four have done the job"
            description="Which is unusual in this industry and is most of why the shortlists are three to five rather than fifteen." />
          <TeamGrid className="mt-8" items={[
            { name: "Michael Dacre", role: "Machining and setting — eleven years on the tools", photo: null },
            { name: "Sonia Whitham", role: "Maintenance and electrical — time-served, 4th year apprentice mentor", photo: null },
            { name: "Ray Okonjo", role: "Fabrication and welding — coded, still holds his tickets", photo: null },
            { name: "Bev Astley", role: "Operations, planning and quality — twenty years in aerospace scheduling", photo: null },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="From both sides" title="A client and a candidate on the same placement" />
              {/* Both audiences quoted, deliberately — a staffing site that only
                  quotes clients tells a candidate whose side it is on. */}
              <TestimonialGrid className="mt-6" columns={1} items={[
                { quote: "They turned the first role down. Told me £34k would not fill it in Rotherham and they were right — we went to £38k and had somebody in three weeks.", name: "Julia Kenworthy", role: "Operations director, subcontract machining" },
                { quote: "Michael told me about the car park flooding before I took the job. That is a stupid small thing and it is the reason I trusted the rest of it.", name: "Danny Rowntree", role: "CNC setter, placed 2024" },
                { quote: "I said no to a role they put to me and they did not ring back three times trying to change my mind. First agency that has ever happened with.", name: "Amara Nwosu", role: "Quality inspector, placed 2025" },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="By both sides" />
              <Faq className="mt-6" items={[
                { question: "Do you charge candidates anything?", answer: "No, and it is illegal to. Any agency asking you for money for a CV rewrite, a training course or a 'registration fee' is breaking the Employment Agencies Act, and it is worth reporting." },
                { question: "Will my current employer find out?", answer: "Not from us. We name the client to you before we send anything anywhere, and we do not take references until you have an offer in writing." },
                { question: "Why is your fee not the cheapest?", answer: "It is not the dearest either. 18% against the 15–25% range in this region, and 15% if we are the only agency on it. What you are not paying for is a longer shortlist somebody else has to sift." },
                { question: "Can we hire somebody you placed as a temp?", answer: "Yes, and after twelve weeks there is no transfer fee at all. Before twelve there is a sliding one, and it is in the terms rather than sprung at the point you ask." },
                { question: "Do you do executive or office roles?", answer: "No. Engineering and manufacturing, shop floor to plant manager, and nothing else. Somebody who tells you they do everything is telling you they specialise in nothing." },
                { question: "How far do you cover?", answer: "Sheffield, Rotherham, Barnsley, Doncaster and Chesterfield, and we will not take a role we cannot get to in half an hour — because the visit is the method and a visit we cannot make is a role we would fill badly." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
