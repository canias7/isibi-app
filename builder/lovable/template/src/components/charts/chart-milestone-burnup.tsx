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

const done = [0, 4, 9, 15, 22, 28, 35, 41, 48, 54, 59]
const scope = [52, 52, 52, 52, 55, 61, 61, 61, 61, 61, 61]
const milestones = [{ at: 4, label: "review" }, { at: 8, label: "beta" }]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Milestone Burnup</CardTitle>
        <CardDescription>Work done rising towards a scope that moved.</CardDescription>
      </CardHeader>
      <CardContent>
        <MilestoneBurnup done={done} scope={scope} milestones={milestones} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Scope grew by nine mid-project <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
