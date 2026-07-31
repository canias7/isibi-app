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

const values = Array.from({ length: 300 }, (_, i) => {
  const p = (i + 0.5) / 300
  return Math.round(18 + Math.pow(p, 3) * 120)
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric with Distribution</CardTitle>
        <CardDescription>The headline, and the spread behind it.</CardDescription>
      </CardHeader>
      <CardContent>
        <MetricDistribution label="Average spend" value="£34" values={values} marker={34} note="Mean £34 · median £24" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The mean hides a long tail <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
