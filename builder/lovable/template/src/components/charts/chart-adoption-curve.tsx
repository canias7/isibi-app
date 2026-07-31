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

const points = [
  { label: "W0", share: 0 }, { label: "W2", share: 0.06 }, { label: "W4", share: 0.18 },
  { label: "W6", share: 0.31 }, { label: "W8", share: 0.44 }, { label: "W10", share: 0.55 },
  { label: "W12", share: 0.62 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adoption Curve</CardTitle>
        <CardDescription>Share of the base using the new booking flow.</CardDescription>
      </CardHeader>
      <CardContent>
        <AdoptionCurve points={points} launchAt={1} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          62% within three months <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
