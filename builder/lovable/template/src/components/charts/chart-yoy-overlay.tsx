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

const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
const years = [
  { label: "2022", values: [180, 172, 195, 210, 228, 241, 236, 219, 244, 251, 262, 288] },
  { label: "2023", values: [198, 189, 214, 231, 248, 262, 254, 238, 266, 274, 285, 312] },
  { label: "2024", values: [212, 205, 244, 268, 289, 304, 298, 281, 311, 322, 336, 368] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Year on Year</CardTitle>
        <CardDescription>Each year on the same month axis.</CardDescription>
      </CardHeader>
      <CardContent>
        <YoYOverlay years={years} months={months} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          This year is ahead from March <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
