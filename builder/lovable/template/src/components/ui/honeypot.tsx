import { useId } from "react";
/**
 * A spam trap. A field a person never sees and a bot fills in.
 *
 * Hidden with position and clip, NOT `display:none` or `hidden` — the crude
 * bots this catches skip anything obviously hidden, and the good screen
 * readers this must not disturb are excluded by `aria-hidden` and
 * `tabIndex={-1}` instead.
 *
 * `autoComplete="off"` matters as much as the hiding: without it a browser
 * helpfully fills the trap with the visitor's own address and every genuine
 * enquiry is thrown away as spam.
 *
 * The server decides. This only supplies the field; a filled `_gotcha` means
 * discard, and the reply to the sender should still say "sent" — telling a
 * bot it was caught is how the next one gets past.
 */
export function Honeypot({ name = "_gotcha" }: { name?: string }) {
  // THE `name` IS THE CONTRACT AND THE `id` IS NOT. `_gotcha` is what the server
  // looks for, so it stays fixed — but it was used as the id too, and two forms
  // on one page then rendered the same id twice, with the first form's label
  // pointing at both. Two forms on a page is the ordinary case: an enquiry form
  // and a newsletter sign-up.
  const uid = useId();
  return (
    <div data-slot="honeypot" aria-hidden="true"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
      <label htmlFor={uid}>Leave this field empty</label>
      <input id={uid} name={name} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}
