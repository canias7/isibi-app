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

const stages = ["Enquiry", "Booking", "Visit", "Follow-up"]
const lanes = [
  { label: "Customer", steps: [{ stage: 0, label: "Sends enquiry" }, { stage: 2, label: "Attends" }] },
  { label: "Front desk", steps: [{ stage: 1, label: "Confirms slot" }, { stage: 3, label: "Sends review link" }] },
  { label: "Stylist", steps: [{ stage: 2, label: "Cuts" }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Swimlane</CardTitle>
        <CardDescription>Who does what, in what order.</CardDescription>
      </CardHeader>
      <CardContent>
        <Swimlane lanes={lanes} stages={stages} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The hand-off to the stylist is the bottleneck <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
