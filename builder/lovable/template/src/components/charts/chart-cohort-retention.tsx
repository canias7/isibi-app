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

const cohorts = [
  { label: "Jan", size: 120, retained: [120, 71, 54, 44, 38, 33] },
  { label: "Feb", size: 138, retained: [138, 84, 62, 51, 43] },
  { label: "Mar", size: 152, retained: [152, 106, 88, 74] },
  { label: "Apr", size: 141, retained: [141, 89, 68] },
  { label: "May", size: 166, retained: [166, 101] },
  { label: "Jun", size: 174, retained: [174] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohort Retention</CardTitle>
        <CardDescription>Who comes back, by the month they joined.</CardDescription>
      </CardHeader>
      <CardContent>
        <CohortGrid cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          March's cohort sticks best <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
