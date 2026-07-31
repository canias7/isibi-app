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

const values = [42, 44, 41, 46, 45, 48, 44, 47, 52, 58, 54, 51, 49, 47, 50, 48, 46, 44, 47, 49, 52, 50, 48, 51]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bollinger Bands</CardTitle>
        <CardDescription>A moving average with a two-sigma band.</CardDescription>
      </CardHeader>
      <CardContent>
        <BollingerBands values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One week broke the upper band <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
