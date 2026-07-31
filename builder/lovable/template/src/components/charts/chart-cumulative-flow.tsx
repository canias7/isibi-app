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

const periods = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]
const states = [
  { label: "Done", values: [2, 5, 9, 14, 20, 27, 33, 41] },
  { label: "Review", values: [3, 4, 4, 6, 8, 9, 11, 12] },
  { label: "In progress", values: [5, 6, 7, 6, 7, 6, 7, 6] },
  { label: "To do", values: [22, 21, 19, 17, 13, 10, 6, 3] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Flow</CardTitle>
        <CardDescription>Work in each state over time.</CardDescription>
      </CardHeader>
      <CardContent>
        <CumulativeFlow states={states} periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The review band is widening <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
