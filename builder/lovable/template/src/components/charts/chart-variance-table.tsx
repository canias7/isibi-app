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
  { label: "Revenue", actual: 8420, budget: 7800 },
  { label: "Staff", actual: 3610, budget: 3200 },
  { label: "Rent", actual: 1800, budget: 1800 },
  { label: "Stock", actual: 880, budget: 1000 },
  { label: "Marketing", actual: 240, budget: 400 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variance Table</CardTitle>
        <CardDescription>Actual against budget, with the gap drawn.</CardDescription>
      </CardHeader>
      <CardContent>
        <VarianceTable rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Staff cost is the overspend <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
