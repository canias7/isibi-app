import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KpiRow, DashboardGrid, AnnotatedChart, SparklineMatrix, ProgressRingGrid, MetricDistribution, WordTree, KwicList, HeadcountPyramid, MilestoneBurnup } from "./lib/composite"

const rings = [
  { label: "Onboarding", value: 92 },
  { label: "Training", value: 41 },
  { label: "Compliance", value: 100 },
  { label: "Reviews", value: 68 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Ring Grid</CardTitle>
        <CardDescription>Several completions at once.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProgressRingGrid rings={rings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Training is the one behind <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
