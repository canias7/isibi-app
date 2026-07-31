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

const events = [
  { at: 0, label: "Brief", note: "3 Feb", done: true },
  { at: 2, label: "Design", note: "18 Feb", done: true },
  { at: 4.5, label: "Build", note: "9 Mar", done: true },
  { at: 6.5, label: "Review", note: "22 Mar" },
  { at: 8, label: "Launch", note: "1 Apr" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Timeline</CardTitle>
        <CardDescription>Milestones on one axis.</CardDescription>
      </CardHeader>
      <CardContent>
        <EventTimeline events={events} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two left before launch <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
