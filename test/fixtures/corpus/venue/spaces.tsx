// venue /spaces — each room in full: layouts and limits. The capacity table
// appears once for the whole site and once per room, because somebody comparing
// four rooms and somebody deciding on one are reading two different things.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CapacityTable } from "@/components/ui/capacity-table";
import { CtaBand } from "@/components/ui/cta-band";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/spaces")({ component: P });
const ROOMS = [
  {
    name: "The threshing floor",
    size: "18m × 11m · 198m²",
    note: "Original flags, oak trusses, step-free from the yard",
    capacities: { Standing: 200, "Seated, rounds": 120, "Seated, long": 140, Theatre: 160, Cabaret: 90 },
    blurb: "The room people come for. Six metres to the ridge, five sets of oak trusses, and a floor of the original threshing flags — which are uneven, so heels are a real consideration and we say so before the viewing rather than after.",
    facts: [
      ["Heating", "Underfloor, on two hours before you arrive"],
      ["Power", "Three-phase, 63A, at both ends"],
      ["Access", "Step-free from the yard. Double doors 2.4m wide"],
      ["Sound", "Limiter set at 96dB. Nothing has ever tripped it"],
      ["Not suitable for", "Anything needing a flat floor — no rink, no dance comps"],
    ],
  },
  {
    name: "The hayloft",
    size: "14m × 8m · 112m²",
    note: "First floor, lift and stairs, low beams at the north end",
    capacities: { Standing: 110, "Seated, rounds": 60, "Seated, long": 72, Theatre: 90 },
    blurb: "Upstairs, with the roof timbers close enough to touch and a window down the length of the south wall. The beams at the north end are 1.9m, which is fine for most people and not for all, so we hire it with the north bay left clear.",
    facts: [
      ["Heating", "Radiators, plus the heat that comes up from below"],
      ["Power", "16A ring, four double sockets"],
      ["Access", "Passenger lift for eight, plus the stair"],
      ["Sound", "No limiter — it is above the threshing floor, so both cannot be loud"],
      ["Not suitable for", "Anything over 110 people, or any staging over 2.2m"],
    ],
  },
  {
    name: "The granary",
    size: "9m × 6m · 54m²",
    note: "Own entrance and bar. Used as a green room or a crèche",
    capacities: { Standing: 50, "Seated, long": 28, Boardroom: 18 },
    blurb: "A separate building with its own door onto the lane, which is the whole point of it. Hired on its own for meetings and small wakes, or alongside the barn as a green room, a children's room or somewhere to put the people who want to sit down.",
    facts: [
      ["Heating", "Woodburner and electric backup"],
      ["Power", "13A domestic. Not for catering equipment"],
      ["Access", "One 90mm step at the lane door, ramp available"],
      ["Kitchen", "Sink, kettle, fridge. Not a prep kitchen"],
      ["Not suitable for", "Anything needing to be heard from the main barn"],
    ],
  },
  {
    name: "The walled yard",
    size: "24m × 16m",
    note: "Covered at one end. Marquee anchors already set",
    capacities: { Standing: 250, "Seated, long": 120 },
    blurb: "Cobbled, walled on three sides, with a covered bay at the north end that seats forty in the rain. The marquee anchors are already in the ground, so a stretch tent goes up in an hour and does not need weights.",
    facts: [
      ["Cover", "Covered bay seats 40. Marquee anchors for a 12m stretch tent"],
      ["Power", "32A at two points, weatherproof"],
      ["Access", "Level throughout, cobbles are the only obstacle"],
      ["Curfew", "Amplified sound outdoors stops at 11pm — planning condition, not ours"],
      ["Not suitable for", "A wet-weather plan on its own. Always pair it with a barn"],
    ],
  },
];
function P() {
  return (
    <SiteChrome name="Thrybergh Barn" tagline="A stone threshing barn for hire, ten minutes from Rotherham."
      links={[{ label: "Home", href: "/" }, { label: "Enquire", href: "/enquire" }]}
      action={{ label: "Check a date", href: "/enquire" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The spaces" title="Four rooms, and what each will really take"
          description="Every number below is the fire certificate figure, not an optimistic one. Where a room cannot do a layout it says so instead of quietly leaving it out." />

        <CapacityTable className="mt-10" caption="All four, side by side" rooms={ROOMS} />

        <div className="mt-14 space-y-14">
          {ROOMS.map((r) => (
            <section key={r.name} className="border-t border-border pt-10">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">{r.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{r.size} · {r.note}</p>
                  <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{r.blurb}</p>
                  <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
                    {r.facts.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-3">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <SafeImage src={null} alt={r.name} ratio="4/3" fallbackSeed={r.name} />
                  <CapacityTable className="mt-6" caption="This room" rooms={[r]} />
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14">
          <CtaBand title="Come and stand in it"
            description="Viewings on most weekday evenings and any Sunday nothing is booked. It takes about forty minutes and nobody will follow it up with a phone call."
            action={{ label: "Check your date", href: "/enquire" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
