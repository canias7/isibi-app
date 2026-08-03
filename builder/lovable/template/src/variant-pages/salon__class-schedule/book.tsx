// salon/class-schedule /book — the family books a SLOT: pick a time, it is
// yours, nobody else can have it. Booking a class is a different transaction
// and gets a different page: the time is fixed, the thing that varies is
// whether there is a mat left, and the interesting states are the ones a slot
// picker does not have — full, waiting list, and "book the same one every week".
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BookingCredits } from "@/components/ui/booking-credits";
import { BusyButton } from "@/components/ui/busy-button";
import { RecurrenceSummary } from "@/components/ui/recurrence-summary";
import { SectionHeader } from "@/components/ui/section-header";
import { SlotCapacity } from "@/components/ui/slot-capacity";
import { SuccessPanel } from "@/components/ui/success-panel";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { WeekStrip } from "@/components/ui/week-strip";
import { CLASSES, DAYS, hhmm, type Klass } from "./index";
export const Route = createFileRoute("/book")({ component: P });
const DAY_OF = { mon: "2026-08-03", tue: "2026-08-04", wed: "2026-08-05", thu: "2026-08-06", fri: "2026-08-07", sat: "2026-08-08", sun: "2026-08-09" } as const;
function P() {
  const [day, setDay] = useState<string | null>("2026-08-04");
  const [picked, setPicked] = useState<Klass | null>(null);
  const [weekly, setWeekly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const key = (Object.keys(DAY_OF) as (keyof typeof DAY_OF)[]).find((k) => DAY_OF[k] === day);
  const list = key ? CLASSES.filter((c) => c.lane === key) : [];
  return (
    <SiteChrome name="Wharf Studio" tagline="Pilates, reformer and yoga in a converted grain store. Ipswich waterfront."
      links={[{ label: "The timetable", href: "#/" }, { label: "Your classes", href: "#/manage" }, { label: "What a class is like", href: "#/work" }]}
      action={{ label: "The timetable", href: "#/" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {done ? (
          <>
            <SuccessPanel title={`Booked — ${picked?.name}, ${key && DAYS.find((d) => d.key === key)!.label} ${picked && hhmm(picked.start)}`}
              description={weekly
                ? "And every week after it at the same time. We take one class off your pack each week, the evening before, and stop the moment you say so."
                : "One class off your pack. Come five minutes early if it is your first time in that room."}
              action={{ label: "See your classes", href: "#/manage" }} />
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Free to cancel up to four hours before and the class goes back on your pack. Inside
              four hours it is used — not as a penalty, but because past that point nobody on the
              waiting list can rearrange their evening around it.
            </p>
          </>
        ) : (
          <>
            <SectionHeader eyebrow="Book" title="Pick the day, then the class"
              description="You are not picking a time — the times are fixed and they are on the timetable. What you are picking is a mat, and how many are left is the only thing that changes." />

            <div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <WeekStrip start={new Date(2026, 7, 3)} value={day} onSelect={(iso) => { setDay(iso); setPicked(null); }} />

                <div className="mt-6 space-y-3">
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Nothing on that day. Sunday has two and Saturday has three.
                    </p>
                  ) : list.map((c) => {
                    const full = c.left === 0;
                    const on = picked?.id === c.id;
                    return (
                      <div key={c.id}
                        className={`rounded-lg border p-4 ${on ? "border-foreground bg-muted/60" : "border-border"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-base font-medium">
                              <span className="tabular-nums">{hhmm(c.start)}–{hhmm(c.end)}</span> · {c.name}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{c.teacher} · {c.level} · {c.cap} mats</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <SlotCapacity left={c.left} total={c.cap} unit="mats" />
                            {/* A FULL CLASS STAYS ON THE PAGE AND SAYS SO. Hiding
                                it makes a busy timetable look like an empty one,
                                and the waiting list is a real route in — about a
                                third of them come up. */}
                            <button type="button" onClick={() => setPicked(c)}
                              className={`rounded-md px-4 py-2 text-sm font-medium ${full ? "border border-border" : "bg-primary text-primary-foreground"}`}>
                              {full ? "Join the waiting list" : on ? "Selected" : "Book this"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="rounded-lg border border-border p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Your pack</p>
                  <div className="mt-3">
                    <BookingCredits balance={6} expiring={0} rollsOver unit="class"
                      rates={[
                        { id: "mat", what: "Any mat class", costs: 1 },
                        { id: "ref", what: "Reformer", costs: 1 },
                        { id: "fam", what: "Family class, two people", costs: 2 },
                      ]} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    A ten-pack has no expiry. Reformer costs the same as a mat class, which is the
                    thing most studios charge double for and we do not.
                  </p>
                </div>

                {picked ? (
                  picked.left === 0 ? (
                    <div className="mt-6 rounded-lg border border-border p-5">
                      <p className="text-base font-medium">{picked.name} is full</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {picked.cap} mats and {picked.cap} people. Join the list and we will text you
                        if somebody drops — usually the evening before, and you get two hours to say
                        yes. Nothing comes off your pack unless you get in.
                      </p>
                      <div className="mt-4">
                        <WaitlistForm onSubmit={() => setDone(true)}
                          note="About a third of waiting-list places come up. We text rather than email, because the notice is short." />
                      </div>
                    </div>
                  ) : (
                    <form className="mt-6 rounded-lg border border-border p-5" onSubmit={(e) => {
                      e.preventDefault(); setBusy(true);
                      setTimeout(() => { setBusy(false); setDone(true); }, 500);
                    }}>
                      <p className="text-base font-medium">
                        {picked.name}, {key && DAYS.find((d) => d.key === key)!.label} <span className="tabular-nums">{hhmm(picked.start)}</span>
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {picked.teacher} · {picked.level} · one class off your pack
                      </p>

                      {/* THE THING A SLOT PICKER CANNOT OFFER. A class is the
                          same time every week, so "and every week after it" is
                          the natural booking — and it is how somebody actually
                          builds a habit rather than re-deciding each Sunday. */}
                      <label className="mt-4 flex items-start gap-3 rounded-md border border-border p-3">
                        <input type="checkbox" className="mt-1 size-4" checked={weekly}
                          onChange={(e) => setWeekly(e.target.checked)} />
                        <span className="text-sm leading-relaxed">
                          <span className="block font-medium">And every week after it</span>
                          <span className="block text-muted-foreground">
                            Same class, same time, booked automatically. Stop it any time in one click.
                          </span>
                        </span>
                      </label>
                      {weekly && (
                        <div className="mt-3">
                          <RecurrenceSummary freq="week" interval={1}
                            days={[["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(key ?? "tue")]} />
                        </div>
                      )}

                      <div className="mt-5">
                        <BusyButton busy={busy} type="submit" className="w-full">
                          {weekly ? "Book it every week" : "Book this class"}
                        </BusyButton>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Free to cancel up to four hours before and the class goes back on your pack.
                      </p>
                    </form>
                  )
                ) : (
                  <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm leading-relaxed text-muted-foreground">
                    Pick a class on the left. If your usual one is full, the waiting list is a real
                    route in rather than a consolation — about a third come up.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </SiteChrome>
  );
}
