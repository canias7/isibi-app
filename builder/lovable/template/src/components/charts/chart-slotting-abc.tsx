import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SlottingAbc } from "@/components/charts/lib/warehouse"
let s = 505
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
// the stored class is the one set LAST quarter, so it follows the pick counts
// with a little drift — a randomly assigned label makes almost every line look
// misfiled and says nothing about a stale classification
const lines = Array.from({ length: 90 }, (_, i) => {
  const picksPerWeek = Math.max(2, Math.round(Math.pow(rnd(), 2.2) * 160))
  const drifted = picksPerWeek * (0.7 + rnd() * 0.7)
  return {
    sku: `SKU-${1000 + i}`,
    picksPerWeek,
    distanceM: 8 + Math.round(rnd() * 112),
    abc: (drifted > 44 ? "A" : drifted > 14 ? "B" : "C") as "A" | "B" | "C",
  }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slotting</CardTitle>
        <CardDescription>The class derived from demand, not from the record</CardDescription>
      </CardHeader>
      <CardContent>
        <SlottingAbc lines={lines} walkSecondsPerMetre={1.1} labourCostPerHour={16.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The top right of this plot is where the money is <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pick face, 90 lines
        </div>
      </CardFooter>
    </Card>
  )
}
