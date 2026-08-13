import * as React from "react";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BusyButton } from "@/components/ui/busy-button";
import { Honeypot } from "@/components/ui/honeypot";
import { cn } from "@/lib/utils";
/**
 * Name, email, message — the form nearly every site has.
 *
 * Three fields and no more. Every extra one measurably loses enquiries, and
 * "company", "how did you hear about us" and a phone number are all things
 * that can be asked in the reply.
 *
 * The phone field is opt-in via `askPhone` for the trades where a call back
 * IS the reply.
 */
export function ContactForm({ onSubmit, busy, error, sent, askPhone, className }: {
  onSubmit: (v: { name: string; email: string; phone?: string; message: string }) => void;
  busy?: boolean; error?: string | null; sent?: boolean; askPhone?: boolean; className?: string;
}) {
  const [v, setV] = React.useState({ name: "", email: "", phone: "", message: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  if (sent) {
    return (
      <div className={cn("rounded-lg border border-border p-6 text-center", className)}>
        <p className="text-sm font-medium">Thanks — we have your message.</p>
        <p className="mt-1 text-sm text-muted-foreground">We will get back to you shortly.</p>
      </div>
    );
  }
  return (
    <form className={cn("space-y-4", className)}
      onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, phone: askPhone ? v.phone : undefined }); }}>
      <FormRow label="Your name" required>
        <Input required autoComplete="name" value={v.name} onChange={set("name")} />
      </FormRow>
      <FormRow label="Email" required>
        <Input type="email" required inputMode="email" autoComplete="email"
          value={v.email} onChange={set("email")} />
      </FormRow>
      {askPhone && (
        <FormRow label="Phone">
          <Input type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} />
        </FormRow>
      )}
      <FormRow label="Message" required>
        <Textarea required rows={5} value={v.message} onChange={set("message")} />
      </FormRow>
      <Honeypot />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <BusyButton type="submit" busy={busy} busyLabel="Sending…">Send</BusyButton>
    </form>
  );
}
