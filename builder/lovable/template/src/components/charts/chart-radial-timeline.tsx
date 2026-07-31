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

const hours = [0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 11, 14, 17, 12, 15, 18, 16, 13, 9, 4, 1, 0, 0, 0]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radial Timeline</CardTitle>
        <CardDescription>Twenty-four hours as a clock face.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <RadialTimeline hours={hours} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing before nine, nothing after seven <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
