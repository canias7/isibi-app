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

const tiles = [
  { label: "Revenue", span: 2, body: <div className="text-[22px] font-semibold tabular-nums">£8,420</div> },
  { label: "Bookings", body: <div className="text-[22px] font-semibold tabular-nums">268</div> },
  { label: "Rating", body: <div className="text-[22px] font-semibold tabular-nums">4.6</div> },
  { label: "By service", span: 2, rows: 2 },
  { label: "By day", span: 2, rows: 2 },
  { label: "Recent bookings", span: 4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Grid</CardTitle>
        <CardDescription>The frame tiles are assembled into.</CardDescription>
      </CardHeader>
      <CardContent>
        <DashboardGrid tiles={tiles} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Spans and rows, nothing else <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
