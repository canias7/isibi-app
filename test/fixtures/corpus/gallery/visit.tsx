// gallery /visit — hours, admission, access, getting here. The page an
// institution usually writes last and a visitor reads first.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ExhibitionCard } from "@/components/ui/exhibition-card";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/visit")({ component: P });
const NOW = new Date(2026, 7, 2);
function P() {
  return (
    <SiteChrome name="The Grinding Shop" tagline="A contemporary art gallery in a former cutlery works, Kelham Island, Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "This show", href: "/exhibition" }]}
      action={{ label: "What's on", href: "/" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Visit" title="Free, five days a week, and you can just turn up"
          description="No ticket, no timed slot, no donation box by the door. The only ticketed show is the winter one and it says so on its own card." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Open</h2>
            <OpeningHours className="mt-4" days={[
              { day: 0, label: "Sunday", open: "11:00", close: "16:00" },
              { day: 1, label: "Monday" },
              { day: 2, label: "Tuesday" },
              { day: 3, label: "Wednesday", open: "10:00", close: "17:00" },
              { day: 4, label: "Thursday", open: "10:00", close: "20:00" },
              { day: 5, label: "Friday", open: "10:00", close: "17:00" },
              { day: 6, label: "Saturday", open: "10:00", close: "17:00" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Thursday is the late one, until eight, and it is the quietest evening in the building.
              Closed Monday and Tuesday, and between Christmas and the second of January.
            </p>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Admission</h2>
            <dl className="mt-4 divide-y divide-border border-y border-border text-base">
              {[
                ["The Long Room", "Free, always"],
                ["Gallery 2", "Free, except the winter show"],
                ["A Quiet Trade (from 14 Nov)", "£6 · £4 concessions · under-18s free"],
                ["Workshops", "£12 typically, materials included"],
                ["Groups over 10", "Free, but tell us so the room is not full"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                  <dt>{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Access</h2>
            <ul className="mt-4 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Step-free throughout, including the mezzanine, by a lift that takes a powerchair.</li>
              <li className="py-3">Accessible WC on the ground floor, with a hoist and a changing bench.</li>
              <li className="py-3">Seating in every room. There are folding stools at the desk to carry round.</li>
              <li className="py-3">Large-print and braille guides for every show, at the desk, without having to ask.</li>
              <li className="py-3">Hearing loop at the desk and in the studio. BSL-interpreted talks are marked on the events list.</li>
              <li className="py-3">Assistance dogs welcome everywhere. Water bowl at the desk.</li>
              <li className="py-3">Relaxed opening the first Sunday of the month: lights up, sound off, nobody minds noise.</li>
              <li className="py-3">Two blue badge bays on Alma Street, twenty metres from the door.</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              If something here would stop you coming, ring and say so. We have moved a whole show
              down a floor before now and it was not a fuss.
            </p>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Getting here" title="Kelham Island" />
              <LocationCard className="mt-6" name="The Grinding Shop"
                address="Unit 4, Alma Street, Kelham Island, Sheffield, S3 8SA"
                note="Twelve minutes' walk from the Cathedral tram stop, twenty from the station. The 7 and the 8 stop on Corporation Street. Two blue badge bays outside; everything else is pay and display on Russell Street." />
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {[
                  ["By tram", "Cathedral or Shalesmoor, both about twelve minutes on foot and both level."],
                  ["By bike", "Racks under cover by the door. The Upper Don Trail passes the end of the street."],
                  ["Parking", "Two blue badge bays outside. Otherwise Russell Street, £1.50 for two hours."],
                  ["Nearby", "Kelham Island Museum is four minutes away and a joint visit is a decent afternoon."],
                ].map(([k, v]) => (
                  <div key={k} className="border-t border-border pt-4">
                    <p className="font-medium">{k}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <SafeImage src={null} alt="The entrance on Alma Street" ratio="4/3" />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you come" />
              <Faq className="mt-6" items={[
                { question: "Is there a café?", answer: "No. There is a water fountain and a kettle you are welcome to use. Two decent places are within three minutes and we would rather point you at them than run a bad one." },
                { question: "Can I bring children?", answer: "Yes, to everything. There is a drawing table in the Long Room with proper materials on it rather than a colouring sheet." },
                { question: "Can I take photographs?", answer: "Yes, without flash, in every show unless a sign in that room says otherwise. Post them wherever you like." },
                { question: "How long does it take?", answer: "About forty minutes for one show, ninety for the building. Thursday evening is the time to come if you want the room to yourself." },
                { question: "Do you sell the work?", answer: "Sometimes, and the artist gets all of it. Ask at the desk — there is no commission and no gallery cut, which is unusual and deliberate." },
              ]} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">On while you are here</h2>
              <div className="mt-6 space-y-12">
                <ExhibitionCard now={NOW} href="/exhibition"
                  title="Ways of Making Do" artist="Mbanefo, Fenn, Ise"
                  from="2026-06-06" to="2026-08-30" room="The Long Room" admission="Free" />
                <ExhibitionCard now={NOW} href="/exhibition"
                  title="Bessemer, After" artist="Kit Aspinall"
                  from="2026-07-18" to="2026-08-09" room="Gallery 2" admission="Free" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
