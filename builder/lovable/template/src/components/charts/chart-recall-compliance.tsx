import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RecallCompliance } from "@/components/charts/lib/dentistry"
let s = 349
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
// most patients land near the interval with a long right tail — a distribution
// with no mass at all inside the interval draws a row of hollow dots and says
// nothing about compliance
const gaps = (n: number, assigned: number, tail: number) =>
  Array.from({ length: n }, () =>
    Math.max(1, Math.round(assigned * (0.85 + rnd() * 0.5 + tail * Math.pow(rnd(), 5)))),
  )
const cohorts = [
  { name: "High risk · 3 months", assignedMonths: 3, actualMonths: gaps(26, 3, 3.2) },
  { name: "Moderate · 6 months", assignedMonths: 6, actualMonths: gaps(34, 6, 1.8) },
  { name: "Low risk · 12 months", assignedMonths: 12, actualMonths: gaps(30, 12, 0.9) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recall</CardTitle>
        <CardDescription>The interval booked against the one kept</CardDescription>
      </CardHeader>
      <CardContent>
        <RecallCompliance cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Shortening a recall on paper moves the mark, not the dots <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three risk groups
        </div>
      </CardFooter>
    </Card>
  )
}
