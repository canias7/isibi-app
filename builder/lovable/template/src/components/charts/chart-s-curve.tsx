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

const plan = [0, 4, 11, 22, 38, 56, 72, 84, 92, 97, 100]
const actual = [0, 3, 8, 16, 29, 44, 63, 79, 90, 96, 100]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>S-Curve</CardTitle>
        <CardDescription>Cumulative progress against plan.</CardDescription>
      </CardHeader>
      <CardContent>
        <SCurve actual={actual} plan={plan} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Behind through the middle, caught up <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
