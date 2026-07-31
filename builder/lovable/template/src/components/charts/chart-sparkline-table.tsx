import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuadrantMatrix, RiskMatrix, CorrelationMatrix, ClusteredHeatmap, Scorecard, VarianceTable, SparklineTable } from "./lib/matrices"

const rows = [
  { label: "Bookings", value: "268", series: [201, 214, 226, 231, 245, 252, 268], delta: "6%" },
  { label: "Revenue", value: "£8,420", series: [7100, 7280, 7540, 7690, 7980, 8210, 8420], delta: "3%" },
  { label: "New customers", value: "41", series: [52, 48, 45, 44, 43, 42, 41], delta: "2%", up: false },
  { label: "Repeat rate", value: "62%", series: [54, 55, 57, 58, 60, 61, 62], delta: "2%" },
  { label: "No-shows", value: "14", series: [7, 8, 9, 11, 12, 13, 14], delta: "8%", up: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sparkline Table</CardTitle>
        <CardDescription>Each metric with its own trend inline.</CardDescription>
      </CardHeader>
      <CardContent>
        <SparklineTable rows={rows} />
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
