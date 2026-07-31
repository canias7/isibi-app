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

const history = [212, 205, 244, 268, 289, 304, 298, 281]
const central = [281, 292, 305, 318, 332, 348]
const bands = [
  [6, 12, 19, 27, 36, 46],
  [12, 24, 38, 54, 72, 92],
  [18, 36, 57, 81, 108, 138],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fan Chart</CardTitle>
        <CardDescription>A projection that widens as it goes.</CardDescription>
      </CardHeader>
      <CardContent>
        <FanChart history={history} central={central} bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Anywhere from 280 to 420 by December <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
