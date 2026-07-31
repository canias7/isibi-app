import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Horizon, CyclePlot, CohortGrid, Burndown, RunChart, EventTimeline, Swimlane, SmallMultiples, SpiralPlot } from "./lib/timeline"

const cycles = [
  { label: "Mon", values: [31, 33, 34, 36, 38, 41] },
  { label: "Tue", values: [22, 25, 29, 33, 38, 44] },
  { label: "Wed", values: [40, 41, 39, 42, 44, 43] },
  { label: "Thu", values: [52, 54, 51, 56, 58, 57] },
  { label: "Fri", values: [71, 74, 73, 76, 78, 81] },
  { label: "Sat", values: [88, 91, 89, 94, 96, 98] },
  { label: "Sun", values: [18, 16, 15, 14, 12, 11] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle Plot</CardTitle>
        <CardDescription>Each weekday's own trend across six months.</CardDescription>
      </CardHeader>
      <CardContent>
        <CyclePlot cycles={cycles} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tuesday is improving, Sunday is not <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
