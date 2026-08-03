// salon/call-now /book — the family's booking page is the slot picker itself.
// Here it is explicitly the FALLBACK, and the honest way to build a fallback is
// to make it ask the same questions the phone call would — the ones that
// actually decide whether an appointment can happen.
//
// So it does not ask for a time. It asks for the four things that determine
// which times are possible, and answers with a text a few hours later. A form
// that took a time slot and then rang to change it would be worse than no form.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { RadioCards } from "@/components/ui/radio-cards";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [service, setService] = React.useState("cut");
  const [access, setAccess] = React.useState<string[]>([]);
  const colour = service === "roots" || service === "full";
  return (
    <SiteChrome name="Hair at Home" tagline="Wendy Frayne. Cutting in kitchens across the East Riding since 2004."
      links={[{ label: "Home", href: "#/" }, { label: "Your appointment", href: "#/manage" }, { label: "What I can do at home", href: "#/work" }]}
      action={{ label: "Ring 07700 900 812", href: "tel:07700900812" }}>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* THE PHONE IS STILL THE FIRST THING, on the form page. Somebody who
            got here and would actually rather ring should not have to go back. */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 p-5">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            <span className="text-base font-medium text-foreground">Changed your mind about the form?</span><br />
            Two minutes on the phone does all of this and you get an answer now rather than this afternoon.
          </p>
          <a className="rounded-md bg-primary px-5 py-2.5 text-base font-semibold tabular-nums text-primary-foreground" href="tel:07700900812">07700 900 812</a>
        </div>

        {sent ? (
          <div className="mt-10">
            <SuccessPanel title="Got it — I will text you this afternoon"
              description="I read these between appointments, so it is usually two or three hours and always the same day. The text will offer you two or three times rather than one, and if neither works just say so."
              action={{ label: "Back to the start", href: "#/" }} />
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Nothing is booked yet and nothing has been taken from you. If it is more urgent than
              this afternoon, ring — that is not a nudge to use the phone, it is genuinely the only
              way to get an answer faster.
            </p>
          </div>
        ) : (
          <>
            <SectionHeader className="mt-10" eyebrow="The fallback" title="The same four questions, in writing"
              description="I have not asked you to pick a time. Which times are possible depends on the answers below and on where I already am that day — so I will come back with two or three that work, by text, this afternoon." />

            <form className="mt-8 space-y-8" onSubmit={(e) => {
              e.preventDefault(); setBusy(true);
              setTimeout(() => { setBusy(false); setSent(true); }, 600);
            }}>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormRow label="Your name" htmlFor="name" required>
                  <Input id="name" name="name" autoComplete="name" required />
                </FormRow>
                <FormRow label="Mobile" htmlFor="phone" required hint="I reply by text. I will not ring unless you ask me to.">
                  <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
                </FormRow>
              </div>

              <FormRow label="Where you are" htmlFor="where" required
                hint="Street and village is plenty — I do not need the number until it is booked.">
                <Input id="where" name="where" autoComplete="address-level2" placeholder="Ferriby Road, Hessle" required />
              </FormRow>

              <div>
                <p className="text-sm font-medium">What you are after</p>
                <div className="mt-3">
                  <RadioCards value={service} onChange={setService} columns={2} options={[
                    { value: "cut", label: "Dry cut", description: "£26 · 45 min · no sink needed" },
                    { value: "blow", label: "Cut and blow dry", description: "£34 · 1 hr · needs a sink" },
                    { value: "gents", label: "Gentlemen's cut", description: "£18 · 30 min" },
                    { value: "restyle", label: "Restyle", description: "£46 · 1 hr 15 · bring a picture" },
                    { value: "roots", label: "Colour, roots", description: "£58 · 1 hr 45 · patch test first" },
                    { value: "full", label: "Full head colour", description: "£82 · 2 hr 30 · patch test first" },
                  ]} />
                </div>
                {/* THE PATCH TEST IS THE ONE THING THAT MAKES AN APPOINTMENT
                    IMPOSSIBLE THIS WEEK, so it is said the moment the choice
                    implies it rather than in a confirmation email. */}
                {colour && (
                  <p className="mt-3 rounded-md border border-border bg-muted/50 p-4 text-sm leading-relaxed">
                    <span className="font-medium">A colour needs a patch test 48 hours before.</span>{" "}
                    I come out and do it, it takes four minutes and there is no charge — but it does
                    mean a colour can never be a same-day job, and it is much better to know that now
                    than on Thursday.
                  </p>
                )}
              </div>

              <CheckboxGroup legend="Anything I should know before I arrive" value={access} onChange={setAccess} columns={2}
                options={[
                  { value: "stairs", label: "There are stairs", hint: "So I leave the heavy bag in the car" },
                  { value: "nosink", label: "No sink I can lean somebody over", hint: "We can still do plenty — it changes what" },
                  { value: "parking", label: "Parking is difficult", hint: "Permit street, narrow lane, that sort of thing" },
                  { value: "notme", label: "It is not for me", hint: "A parent, a partner, somebody I care for" },
                  { value: "dementia", label: "Dementia, or anxious about it", hint: "I will allow longer and talk first. This is a third of my week" },
                  { value: "bed", label: "They are in bed or a chair", hint: "Entirely doable and I do it most weeks" },
                ]} />

              <FormRow label="Anything else" htmlFor="notes"
                hint="Days that suit, days that do not, or anything the boxes above did not cover.">
                <Textarea id="notes" name="notes" rows={4}
                  placeholder="Mornings are easier. Mum is better before eleven." />
              </FormRow>

              <div className="flex flex-wrap items-center gap-4">
                <BusyButton busy={busy} type="submit">Send it to Wendy</BusyButton>
                <p className="text-sm text-muted-foreground">
                  No deposit, nothing taken now, and nothing is booked until we have both agreed a time.
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}
