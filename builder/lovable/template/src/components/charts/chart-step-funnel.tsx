import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NetworkWaterfall, ScrollDepth, ClickGrid, PathTree, AdoptionCurve, AbTestResult, EngagementMatrix, StepFunnel } from "./lib/product"

const steps = [
  { label: "Visited", value: 1200 },
  { label: "Saw prices", value: 780 },
  { label: "Opened form", value: 460 },
  { label: "Picked a slot", value: 310 },
  { label: "Confirmed", value: 260 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step Funnel</CardTitle>
        <CardDescription>Stages with the drop-off spelled out.</CardDescription>
      </CardHeader>
      <CardContent>
        <StepFunnel steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The slot picker loses the most <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
