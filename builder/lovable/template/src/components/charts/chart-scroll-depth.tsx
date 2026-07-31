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

const buckets = [1, 0.94, 0.82, 0.68, 0.55, 0.44, 0.34, 0.27, 0.22, 0.19]
const sections = [{ at: 0.28, label: "prices" }, { at: 0.66, label: "form" }]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scroll Depth</CardTitle>
        <CardDescription>How far down the page people get.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollDepth buckets={buckets} sections={sections} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only a fifth reach the booking form <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
