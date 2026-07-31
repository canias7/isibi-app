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

const rows = ["Haircut", "Beard", "Colour", "Towel"]
const cols = ["Mon", "Wed", "Fri", "Sat"]
const base = (a: number, b: number) => Array.from({ length: 8 }, (_, i) => a + (b - a) * (i / 7))
const series = [
  [base(30, 34), base(38, 41), base(58, 63), base(78, 92)],
  [base(22, 20), base(27, 26), base(40, 41), base(52, 58)],
  [base(6, 12), base(8, 15), base(12, 22), base(18, 34)],
  [base(12, 11), base(15, 14), base(19, 20), base(24, 27)],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sparkline Matrix</CardTitle>
        <CardDescription>Small charts on one shared scale.</CardDescription>
      </CardHeader>
      <CardContent>
        <SparklineMatrix rows={rows} cols={cols} series={series} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday is the only column rising <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
