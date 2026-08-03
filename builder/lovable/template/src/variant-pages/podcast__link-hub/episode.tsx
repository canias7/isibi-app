// podcast/link-hub /episode — the family's "one entry in full". For a link hub
// the entry that matters is the door the whole front page points at, and here
// that is this week's order form. So this page is a transaction, not a post.
//
// It stays in the same narrow column, deliberately. Somebody arrived from a bio
// link, tapped one thing, and is now being asked for money — widening the page
// at that moment is the layout equivalent of changing the subject.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { OrderSummary } from "@/components/ui/order-summary";
import { RadioCards } from "@/components/ui/radio-cards";
import { SlotCapacity } from "@/components/ui/slot-capacity";
import { StepperInput } from "@/components/ui/stepper-input";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/episode")({ component: P });
const LOAVES = [
  { key: "white", name: "White sourdough", price: 4.5, note: "800g. The one everybody starts with" },
  { key: "seeded", name: "Seeded sourdough", price: 5, note: "Sunflower, pumpkin, linseed, and a lot of them" },
  { key: "rye", name: "Dark rye", price: 5.5, note: "Dense, sour, keeps a week. Two of these a bake" },
  { key: "foc", name: "Rosemary focaccia", price: 6, note: "A tray, cut into six. Friday only" },
  { key: "bun", name: "Cinnamon buns, four", price: 8, note: "Friday only, and they go first" },
];
function P() {
  const [qty, setQty] = useState<Record<string, number>>({ white: 1, seeded: 0, rye: 0, foc: 0, bun: 0 });
  const [how, setHow] = useState("bike");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lines = LOAVES.filter((l) => qty[l.key] > 0)
    .map((l) => ({ label: `${l.name} × ${qty[l.key]}`, value: l.price * qty[l.key] }));
  const goods = lines.reduce((s, l) => s + l.value, 0);
  const delivery = how === "bike" && goods > 0 && goods < 15 ? 2 : 0;
  return (
    <SiteChrome name="Bread by Bike" tagline="Sourdough out of a back kitchen in Splott. Delivered on two wheels."
      links={[{ label: "All the links", href: "#/" }, { label: "Everything", href: "#/archive" }, { label: "About", href: "#/about" }]}
      action={{ label: "All the links", href: "#/" }}>

      <div className="mx-auto max-w-md px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← Everything else</a>

        {done ? (
          <div className="mt-6">
            <SuccessPanel title="Ordered — see you Friday"
              description="No payment now. Cash, card or a bank transfer when I hand it over, and the total is on this page if you want to check it."
              action={{ label: "Back to the links", href: "#/" }} />
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              I text the night before with a rough time. If Friday stops working, text back — a
              cancellation on Thursday costs me nothing and a loaf nobody collects costs me a loaf.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">This week</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Order form</h1>
              <div className="mt-4 space-y-3">
                <CutoffTime by="Wednesday 9pm" promise="baked Thursday, with you Friday morning" remaining="2 days" nextPromise="the week after" />
                <SlotCapacity left={19} total={60} warnAt={20} unit="loaves" />
              </div>
            </div>

            <form className="mt-8 space-y-6" onSubmit={(e) => {
              e.preventDefault(); setBusy(true);
              setTimeout(() => { setBusy(false); setDone(true); }, 500);
            }}>
              <div className="space-y-3">
                {LOAVES.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                    <div className="min-w-0">
                      <p className="text-base font-medium">{l.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">£{l.price.toFixed(2)} · {l.note}</p>
                    </div>
                    <StepperInput value={qty[l.key]} min={0} max={6}
                      onChange={(n) => setQty((s) => ({ ...s, [l.key]: n }))} />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium">How you want it</p>
                <div className="mt-3">
                  <RadioCards value={how} onChange={setHow} columns={1} options={[
                    { value: "bike", label: "Delivered Friday morning", description: "Before nine, by bike. £2 under £15, free over — and I only go where the hill allows" },
                    { value: "market", label: "Collect Thursday, Splott market", description: "Free. 8am to 1pm, the stall at the Railway Street end" },
                    { value: "pub", label: "Collect Saturday, the pub yard", description: "Free. 10am to noon at the Clifton, and whatever is left goes cheap at 11:30" },
                  ]} />
                </div>
              </div>

              <FormRow label="Your name" htmlFor="name" required>
                <Input id="name" name="name" autoComplete="name" required />
              </FormRow>
              <FormRow label="Mobile" htmlFor="tel" required hint="I text the night before with a rough time. Nothing else, ever.">
                <Input id="tel" name="tel" type="tel" inputMode="tel" autoComplete="tel" required />
              </FormRow>
              {how === "bike" && (
                <FormRow label="Where" htmlFor="addr" required hint="Splott, Adamsdown, Roath and the flat bit of Penylan. Past the hill I genuinely cannot.">
                  <Input id="addr" name="addr" autoComplete="street-address" required />
                </FormRow>
              )}
              <FormRow label="Anything else" htmlFor="notes" hint="Allergies, a gate that sticks, or where to leave it.">
                <Textarea id="notes" name="notes" rows={3} placeholder="Leave it in the porch, the bell does not work" />
              </FormRow>

              <div className="rounded-lg border border-border p-4">
                <OrderSummary
                  lines={[
                    ...(lines.length ? lines : [{ label: "Nothing chosen yet", value: 0 }]),
                    ...(how === "bike" ? [{ label: "Delivery", value: delivery, note: delivery ? "under £15" : "free over £15" }] : []),
                  ]}
                  total={goods + delivery}
                  note={delivery > 0
                    ? "£2 because it is under £15. Over £15 the bike is free, which is not generosity — one stop is one stop."
                    : how === "bike" ? "Free delivery — you are over £15." : "Collection, so nothing to add."} />
              </div>

              <BusyButton busy={busy} type="submit" className="w-full" disabled={goods === 0}>
                {goods === 0 ? "Choose something first" : "Place the order"}
              </BusyButton>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Nothing is taken now. Pay when I hand it over — cash, card or transfer.
                Allergens: everything contains wheat and is made in a kitchen with sesame in it.
              </p>
            </form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}
