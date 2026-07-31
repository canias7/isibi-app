import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CumulativeFlow, SeasonalDecomposition, YoYOverlay, BollingerBands, Drawdown, PunchCard, SCurve, FanChart, MonthCalendar, RadialTimeline } from "./lib/timeseries2"

const values: Record<number, number> = {}
for (let d = 1; d <= 30; d++) {
  const wd = new Date(Date.UTC(2024, 5, d)).getUTCDay()
  values[d] = wd === 0 ? 2 : wd === 6 ? 18 : wd === 5 ? 13 : 5 + ((d * 7) % 6)
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Month Calendar</CardTitle>
        <CardDescription>A real month grid, shaded by bookings.</CardDescription>
      </CardHeader>
      <CardContent>
        <MonthCalendar year={2024} month={5} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturdays carry the month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
