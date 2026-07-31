import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LapseCurve } from "@/components/charts/lib/actuarial"
let inForce = 100000
const durations = [0.24, 0.14, 0.095, 0.075, 0.062, 0.058, 0.055, 0.053, 0.052, 0.051].map((rate, i) => {
  const start = inForce
  const lapses = Math.round(start * rate)
  inForce = start - lapses
  return { year: i + 1, inForceStart: start, lapses }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lapse</CardTitle>
        <CardDescription>The early spike against the level tail</CardDescription>
      </CardHeader>
      <CardContent>
        <LapseCurve durations={durations} commissionClawbackYears={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The excess decides whether commission is recovered <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Ten durations
        </div>
      </CardFooter>
    </Card>
  )
}
