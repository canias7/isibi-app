// THE APP'S LOOK IS ONE FILE, `theme.json`, written per build from the same
// design step a site's look comes from. Every class the kit and the screens use
// (`bg-paper`, `text-ink`, `bg-primary`…) reads it, so a theme change is a data
// change and never an edit to a screen.
const t = require("./theme.json");
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: t.paper, card: t.card, ink: t.ink, soft: t.soft, line: t.line,
        primary: t.primary, "on-primary": t.onPrimary, accent: t.accent, good: t.good,
      },
      borderRadius: { app: t.radius + "px" },
    },
  },
  plugins: [],
};
