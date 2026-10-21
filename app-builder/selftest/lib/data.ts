import type { Opening } from "@/components/app";
export const LOAVES = [
  { id: "white", name: "Harbour White", price: 4.5, note: "Mild crumb, blistered crust. Our everyday loaf.", tag: "Daily" },
  { id: "rye", name: "Seeded Rye", price: 5.2, note: "Sunflower, pumpkin and linseed in a dark rye.", tag: "Daily" },
  { id: "focaccia", name: "Olive Focaccia", price: 3.8, note: "Green olives, rosemary, flaky salt.", tag: "Fri–Sun" },
  { id: "spelt", name: "Wholemeal Spelt", price: 4.9, note: "Nutty, tender, made with stoneground spelt.", tag: "Weekend" },
];
export const HOURS: Opening[] = [
  { day: 3, open: "07:30", close: "15:00" }, { day: 4, open: "07:30", close: "15:00" }, { day: 5, open: "07:30", close: "15:00" },
  { day: 6, open: "08:00", close: "16:00" }, { day: 0, open: "09:00", close: "14:00" },
];
