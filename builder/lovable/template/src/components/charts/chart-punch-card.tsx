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

const rows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const cols = ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18"]
const values = [
  [2, 4, 5, 6, 4, 5, 6, 7, 5, 2],
  [1, 3, 4, 5, 3, 4, 5, 5, 4, 1],
  [3, 5, 6, 7, 5, 6, 7, 8, 6, 3],
  [4, 6, 8, 9, 7, 8, 9, 10, 8, 4],
  [6, 8, 10, 12, 9, 11, 12, 13, 10, 6],
  [8, 12, 15, 18, 14, 16, 15, 12, 8, 3],
  [1, 2, 2, 3, 2, 2, 1, 1, 0, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Punch Card</CardTitle>
        <CardDescription>Bookings by day and hour, dot by volume.</CardDescription>
      </CardHeader>
      <CardContent>
        <PunchCard rows={rows} cols={cols} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday lunchtime is the peak <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
