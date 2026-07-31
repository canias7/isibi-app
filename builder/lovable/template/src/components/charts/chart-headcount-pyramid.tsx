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

const levels = [
  { label: "Owner", count: 1 },
  { label: "Manager", count: 2 },
  { label: "Senior", count: 5 },
  { label: "Stylist", count: 11 },
  { label: "Apprentice", count: 7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount Pyramid</CardTitle>
        <CardDescription>People by level.</CardDescription>
      </CardHeader>
      <CardContent>
        <HeadcountPyramid levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Widest at the base, as it should be <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
