// housing-association /repairs — what counts as what, the real response times,
// and tracking one already reported.
//
// "WHO IS RESPONSIBLE" IS THE ARGUMENT THAT WASTES EVERYBODY'S TIME. A tenant
// waits three weeks for a landlord to fix something the landlord was never
// going to fix, and finds out on the doorstep. The split is published as a
// plain two-column list rather than as a clause in a tenancy agreement nobody
// has read since they signed it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RepairJob } from "@/components/ui/repair-job";
import { TriageBanner } from "@/components/ui/triage-banner";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/repairs")({ component: P });

const OURS = [
  "The roof, walls, windows, doors and drains",
  "Heating, boilers, radiators and hot water",
  "Wiring, sockets, light fittings and the fuse box",
  "Baths, basins, toilets and the pipework to them",
  "Anything we installed — kitchens, bathrooms, flooring we laid",
  "Communal stairs, lighting, entry doors and grounds",
  "Extractor fans and the ventilation we fitted",
];

const YOURS = [
  "Light bulbs, fuses in plugs, and smoke-alarm batteries",
  "Blocked sinks and toilets where something was put down them",
  "Internal decoration, and making good after your own alterations",
  "Anything you fitted yourself, and anything you damaged",
  "Toilet seats, plugs, chains and shower curtains",
  "Losing your keys — we will board or re-lock and it is chargeable",
  "Garden maintenance, unless it is a communal area",
];

function P() {
  return (
    <SiteChrome
      name="Loxley Valley Housing"
      tagline="What counts as what, and how long each actually takes."
      links={[
        { label: "Home", href: "#/" },
        { label: "Rent and tenancy", href: "#/tenancy" },
      ]}
      action={{ label: "Out of hours: 0114 288 6199", href: "tel:01142886199" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Repairs</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Report online any hour, or ring 0114 288 6100 between nine and five. Emergencies go to
          0114 288 6199, which is answered around the clock by somebody in Sheffield.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Three priorities"
            title="And what we actually manage against each"
            description="The middle figure is below target and has been for three quarters. It is on the front page too, because hiding it would be worse than missing it."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Emergency — 4 hours</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Made safe within four hours, properly fixed within five days. No heating in winter,
                a burst pipe, no power, an insecure door.
              </p>
              <p className="mt-3 text-sm font-medium tabular-nums">94% met, last quarter</p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Urgent — 5 working days</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A partial loss of heating, a leaking but contained pipe, a broken banister, a toilet
                where it is the only one in the home.
              </p>
              <p className="mt-3 text-sm font-medium tabular-nums">88% met, last quarter</p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Routine — 20 working days</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Everything else. A dripping tap, a broken cupboard door, plaster damage, a fence
                panel.
              </p>
              <p className="mt-3 text-sm font-medium tabular-nums">81% met, against a 90% target</p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Who fixes what"
            title="The split, in plain words"
            description="Read this before reporting. Half the frustration in social housing is a tenant waiting three weeks for something that was never going to be attended."
          />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <p className="font-medium">Ours</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {OURS.map((o) => (
                  <li key={o} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Yours</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {YOURS.map((y) => (
                  <li key={y} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full border border-foreground" />
                    <span>{y}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Over 70, disabled, or otherwise unable to manage something on the right-hand list? Ring
            us. We do it and we do not charge — the list is about responsibility, not about leaving
            somebody stuck.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Already reported"
            title="Track it with the reference from your text message"
            description="Sent within an hour of reporting. If you did not get one, the number on file is probably wrong."
          />
          <div className="mt-8 max-w-2xl">
            <RepairJob
              job={{
                ticket: "LVH-88214",
                what: "Boiler losing pressure, no hot water in the mornings",
                priority: "Urgent — 5 working days",
                stage: "booked",
                reportedOn: "29 July",
                targetDate: "5 August",
                appointment: "Wednesday 5 August, 08:00 – 12:00",
                contractor: "Peak Heating (Sheffield) Ltd",
                note: "Part ordered on 30 July and arrived on the 1st. The engineer will carry it, so this should be one visit rather than two.",
              }}
              onLookup={() => {}}
            />
            {/* The late case, shown deliberately. A portal that only ever
                renders a healthy job is a portal nobody can use to hold us to
                anything. */}
            <div className="mt-6">
              <RepairJob
                job={{
                  ticket: "LVH-87990",
                  what: "Kitchen extractor fan not working",
                  priority: "Routine — 20 working days",
                  stage: "parts",
                  reportedOn: "12 June",
                  targetDate: "10 July",
                  late: true,
                  appointment: null,
                  contractor: "Rivelin Electrical",
                  note: "The fan is discontinued and the replacement is on back order. We should have told you that on 10 July rather than leaving it open.",
                }}
                onLookup={() => {}}
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Out of hours" title="What to ring about at three in the morning" />
          <div className="mt-8">
            <TriageBanner
              heading="Emergencies only, but if in doubt ring"
              levels={[
                { when: "You can smell gas", action: "National Gas Emergency Service, before anyone", tel: "0800 111 999", note: "Windows open, no switches, everybody out." },
                { when: "No heat or hot water in winter", action: "Emergency line", tel: "0114 288 6199", note: "Four hours, and heaters brought if the repair will take longer." },
                { when: "Water coming through a ceiling", action: "Emergency line", tel: "0114 288 6199", note: "Stopcock is usually under the kitchen sink." },
                { when: "Your home is not secure", action: "Police first if it has just happened, then us", tel: "0114 288 6199" },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Repair questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I choose the appointment time?",
                  answer:
                    "Morning or afternoon, and we will work round school runs and shifts if you say so. All-day slots were abolished in 2023 because they are an insult to anybody with a job.",
                },
                {
                  question: "What if the contractor does not turn up?",
                  answer:
                    "Ring us and we rebook as an urgent, whatever the original priority. A missed appointment also gets £15 credited to your rent account automatically — you do not have to ask.",
                },
                {
                  question: "There is damp and mould.",
                  answer:
                    "Report it as urgent and we will attend within five days. We do not tell people to open a window and wipe it down; that stopped being an acceptable answer in this sector and it never should have been one.",
                },
                {
                  question: "Can I do a repair myself and be reimbursed?",
                  answer:
                    "Only with written agreement first. There is a right-to-repair scheme for small qualifying jobs where we have failed twice, and we will tell you about it rather than wait to be asked.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The four doors</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/tenancy">Rent and tenancy</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
