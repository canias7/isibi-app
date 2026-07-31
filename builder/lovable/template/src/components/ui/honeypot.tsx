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
  return (
    <div aria-hidden="true"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
      <label htmlFor={name}>Leave this field empty</label>
      <input id={name} name={name} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}
