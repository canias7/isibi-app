import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PatchSla } from "@/components/charts/lib/socops"
let s = 91
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mk = (severity: string, n: number, scale: number) =>
  Array.from({ length: n }, () => ({ severity, ageDays: Math.round(Math.pow(rnd(), 2.1) * scale) }))
const findings = [
  ...mk("critical", 9, 62), ...mk("high", 24, 110),
  ...mk("medium", 41, 220), ...mk("low", 30, 400),
]
const sla = { critical: 7, high: 30, medium: 90, low: 180 }

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patch ageing</CardTitle>
        <CardDescription>Each finding at its own age against the SLA</CardDescription>
      </CardHeader>
      <CardContent>
        <PatchSla findings={findings} sla={sla} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A mean age hides the one very old critical <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Open findings
        </div>
      </CardFooter>
    </Card>
  )
}
