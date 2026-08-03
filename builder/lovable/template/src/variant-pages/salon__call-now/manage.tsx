// salon/call-now /manage — the family's manage page is view, move, cancel.
// A mobile service adds one that matters more than any of them: CONFIRM WHERE
// I AM COMING AND WHAT I WILL FIND. A salon appointment that has the wrong
// address is impossible; a mobile one is merely wrong, and wrong at somebody's
// door at ten past two with the next appointment in Beverley at three.
//
// So the address and the access notes are the top of this page, editable, and
// moving it is below them. Cancelling is a plain link and not a hidden one —
// a cancellation two days out costs nothing and a no-show costs an hour.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BookingSummary } from "@/components/ui/booking-summary";
import { BusyButton } from "@/components/ui/busy-button";
import { CancelPolicy } from "@/components/ui/cancel-policy";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { FormRow } from "@/components/ui/form-row";
import { IcsButton } from "@/components/ui/ics-button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/manage")({ component: P });
function P() {
  const [access, setAccess] = React.useState<string[]>(["parking", "notme"]);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return (
    <SiteChrome name="Hair at Home" tagline="Wendy Frayne. Cutting in kitchens across the East Riding since 2004."
      links={[{ label: "Home", href: "#/" }, { label: "Or use the form", href: "#/book" }, { label: "What I can do at home", href: "#/work" }]}
      action={{ label: "Ring 07700 900 812", href: "tel:07700900812" }}>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Your appointment</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thursday 13 August, about half past four</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          "About" is deliberate and it is on the confirmation too. I book an hour and a quarter for
          this and the one before you is in Willerby — so if that runs over I will text you rather
          than turn up late without saying anything.
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr]">
          {/* WHERE I AM COMING, FIRST. On a salon's manage page the address is
              the salon's and is not a variable. Here it is the single field
              most likely to be wrong and most expensive to have wrong. */}
          <div>
            <SectionHeader eyebrow="The important half" title="Where I am coming, and what I will find"
              description="Change any of this up to the morning of and it costs nothing. It is the difference between an appointment that happens and one that does not." />

            <form className="mt-6 space-y-6" onSubmit={(e) => {
              e.preventDefault(); setBusy(true);
              setTimeout(() => { setBusy(false); setSaved(true); }, 500);
            }}>
              <FormRow label="Address" htmlFor="addr" required hint="Including the number this time — I have you as Ferriby Road with no number.">
                <Input id="addr" name="addr" autoComplete="street-address" defaultValue="Ferriby Road, Hessle" required />
              </FormRow>
              <FormRow label="Best number on the day" htmlFor="tel" hint="Only used if I am running late or cannot find you.">
                <Input id="tel" name="tel" type="tel" inputMode="tel" autoComplete="tel" defaultValue="07700 900 448" />
              </FormRow>

              <CheckboxGroup legend="What I should expect" value={access} onChange={setAccess} columns={1}
                options={[
                  { value: "stairs", label: "There are stairs", hint: "So I leave the heavy bag in the car" },
                  { value: "nosink", label: "No sink I can lean somebody over", hint: "Changes what we can do, not whether we can" },
                  { value: "parking", label: "Parking is difficult", hint: "Permit street, narrow lane, that sort of thing" },
                  { value: "notme", label: "It is not for me", hint: "A parent, a partner, somebody I care for" },
                  { value: "dementia", label: "Dementia, or anxious about it", hint: "I will allow longer and talk first" },
                  { value: "dog", label: "There is a dog", hint: "Not a problem at all — I would just rather not be surprised" },
                ]} />

              <FormRow label="Anything else" htmlFor="notes"
                hint="Parked outside is fine, the bell does not work, come round the back — all of it useful.">
                <Textarea id="notes" name="notes" rows={3}
                  defaultValue="Bell does not work. Knock hard or ring me and I will come down." />
              </FormRow>

              <div className="flex flex-wrap items-center gap-4">
                <BusyButton busy={busy} type="submit">Save the changes</BusyButton>
                {saved && <p className="text-sm font-medium">Saved. Nothing else needs doing.</p>}
              </div>
            </form>
          </div>

          <div>
            <SectionHeader eyebrow="What is booked" title="Cut and blow dry, for your mum" />
            <div className="mt-6">
              <BookingSummary
                items={[
                  { label: "What", value: "Cut and blow dry" },
                  { label: "Who for", value: "Margaret Sedgwick" },
                  { label: "When", value: "Thu 13 Aug, about 16:30" },
                  { label: "How long", value: "About an hour, booked for an hour and a quarter" },
                  { label: "Where", value: "Ferriby Road, Hessle" },
                  { label: "Travel", value: "No charge — you are inside the area" },
                ]}
                total={34}
                footer="Cash, card or transfer on the day. No deposit was taken and none is due." />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <IcsButton title="Wendy — cut and blow dry" start="2026-08-13T16:30:00" end="2026-08-13T17:45:00"
                location="Ferriby Road, Hessle" description="Wendy Frayne, Hair at Home. 07700 900 812." />
              <a className="rounded-md border border-border px-4 py-2 text-sm font-medium" href="tel:07700900812">Ring to move it</a>
            </div>

            <div className="mt-8">
              <SectionHeader eyebrow="Moving it" title="Ring, do not use a form" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Same reason as the booking: which times are free depends on where else I am that
                day, and a form that lets you pick one I cannot actually reach is a form that makes
                two people ring each other anyway. Two minutes and it is moved.
              </p>
              <div className="mt-5">
                <SpecList>
                  <SpecRow label="Moving it" value="Free, any notice" note="Including the morning of. Things happen" highlight />
                  <SpecRow label="Cancelling" value="Free before the day" note="Ring or text — a text is completely fine for this" highlight />
                  <SpecRow label="On the day" value="£10, and only sometimes" note="If I have already set off. Never for illness or a hospital appointment" />
                  <SpecRow label="Not in when I arrive" value="£10" note="Twice in twenty-two years and both times somebody was in hospital, so it was waived both times" />
                </SpecList>
              </div>
              <div className="mt-6">
                <CancelPolicy hours={24} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                <a className="font-medium text-foreground underline underline-offset-4" href="tel:07700900812">Cancel it altogether</a> — a
                plain link, because burying that behind three clicks is how you get a no-show
                instead of a cancellation, and a no-show costs me an hour and you a tenner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
