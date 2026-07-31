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

const values = Array.from({ length: 48 }, (_, i) =>
  40 + i * 0.55 + Math.sin((i / 12) * Math.PI * 2) * 12 + ((i * 37) % 7) - 3
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal Decomposition</CardTitle>
        <CardDescription>Trend, season and what is left over.</CardDescription>
      </CardHeader>
      <CardContent>
        <SeasonalDecomposition values={values} period={12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The trend is up under the seasonality <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
