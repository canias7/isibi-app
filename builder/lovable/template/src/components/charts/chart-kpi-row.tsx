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

const items = [
  { label: "Bookings", value: "268", delta: "6%", series: [201, 214, 226, 231, 245, 252, 268] },
  { label: "Revenue", value: "£8,420", delta: "3%", series: [7100, 7280, 7540, 7690, 7980, 8210, 8420] },
  { label: "Repeat rate", value: "62%", delta: "2%", series: [54, 55, 57, 58, 60, 61, 62] },
  { label: "No-shows", value: "14", delta: "8%", up: false, series: [7, 8, 9, 11, 12, 13, 14] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI Row</CardTitle>
        <CardDescription>The header strip of a dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <KpiRow items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only no-shows are moving the wrong way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
