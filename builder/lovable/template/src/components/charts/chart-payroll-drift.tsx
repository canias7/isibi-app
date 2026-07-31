import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PayrollDrift } from "@/components/charts/lib/payroll"
let s = 517
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
// a spilled salary is placed OUTSIDE the band deliberately — red-circled above
// it after a restructure, or appointed below it — because that is what an
// exception is. Nudging an ordinary salary by a few percent almost never leaves
// the band, and what leaves the band is the entire subject of the chart
const band = (min: number, max: number, n: number, centre: number, spill: number) => ({
  min,
  max,
  salaries: Array.from({ length: n }, () => {
    const t = centre + (rnd() - 0.5) * 0.7
    const inside = min + (max - min) * t
    if (rnd() >= spill) return Math.round(inside / 100) * 100
    const over = rnd() < 0.7
    const out = over ? max * (1.03 + rnd() * 0.12) : min * (0.98 - rnd() * 0.07)
    return Math.round(out / 100) * 100
  }),
})
const grades = [
  { name: "Grade 1", ...band(22000, 27000, 14, 0.42, 0.05) },
  { name: "Grade 2", ...band(26500, 34000, 22, 0.5, 0.08) },
  { name: "Grade 3", ...band(33000, 44000, 26, 0.58, 0.1) },
  { name: "Grade 4", ...band(43000, 58000, 18, 0.66, 0.14) },
  { name: "Grade 5", ...band(56000, 78000, 9, 0.72, 0.2) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay bands</CardTitle>
        <CardDescription>Where people actually sit</CardDescription>
      </CardHeader>
      <CardContent>
        <PayrollDrift grades={grades} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A scale is a policy and a payroll is a history of exceptions <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five grades
        </div>
      </CardFooter>
    </Card>
  )
}
