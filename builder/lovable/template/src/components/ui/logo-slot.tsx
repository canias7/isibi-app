import { useState } from "react";
import { cn } from "@/lib/utils";
/**
 * Where a logo goes, with a text fallback that is never blank.
 *
 * THE FALLBACK IS THE BUSINESS NAME, NOT A PLACEHOLDER ICON. A fresh workspace
 * has no logo, an email client blocks images, and a slow connection shows
 * nothing for a second — in all three the name in text is a working header
 * where a grey box is a broken one.
 *
 * IT FALLS BACK ON A FAILED LOAD TOO, not only on a missing `src`. A logo URL
 * that 404s after the customer moved their file is the case a src check cannot
 * catch, and the browser's own broken-image icon sits in the header next to the
 * alt text — measured, and it looks exactly like a bug in our product.
 *
 * A PLAIN `<img>`, DELIBERATELY, NOT `SafeImage`. That one paints a rounded
 * grey wash behind its subject, which is right for an empty photo slot and
 * wrong behind a transparent logo; and its no-src path would never be reached
 * here, because this component has its own better answer for that.
 *
 * BOTH STATES ARE THE SAME KIND OF BOX — an inline element of the stated
 * height. Measured: with the fallback as plain inline text and the image as
 * inline-block, a header reflowed when a logo was uploaded. Whether a customer
 * has uploaded a logo must not change the layout around it.
 *
 * THE `alt` IS THE NAME, AND NEVER "logo". A screen reader announcing "logo"
 * conveys nothing; announcing "Vance & Co" is the same information a sighted
 * reader gets.
 *
 * LINKING IS THE CALLER'S CHOICE. A logo that is always a link to home is
 * wrong inside an email and inside a print header, and wrapping it here would
 * force it.
 */
export function LogoSlot({ src, name, height = 32, className }: {
  src?: string;
  /** Shown when there is no image, and used as the alt text. */
  name: string;
  /** Rendered height in pixels. */
  height?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = cn("inline-flex items-center align-middle", className);
  if (!src || failed) {
    return (
      <span style={{ height, fontSize: Math.max(14, height * 0.5) }} className={cn(box, "font-medium")}>
        {name}
      </span>
    );
  }
  return (
    <span style={{ height }} className={box}>
      <img src={src} alt={name} onError={() => setFailed(true)}
        className="h-full w-auto object-contain" />
    </span>
  );
}
