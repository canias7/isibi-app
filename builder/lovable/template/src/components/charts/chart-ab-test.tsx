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

const arms = [
  { label: "Control", rate: 0.124, low: 0.111, high: 0.138, n: 4820 },
  { label: "Variant", rate: 0.149, low: 0.135, high: 0.164, n: 4790 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A/B Test Result</CardTitle>
        <CardDescription>Both arms, and the difference underneath.</CardDescription>
      </CardHeader>
      <CardContent>
        <AbTestResult arms={arms} difference={{ estimate: 0.025, low: 0.006, high: 0.044 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The difference clears zero <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
