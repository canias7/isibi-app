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

const items = [
  { label: "Fix booking bug", x: 0.88, y: 0.9 },
  { label: "Order stock", x: 0.79, y: 0.34 },
  { label: "New price list", x: 0.24, y: 0.82 },
  { label: "Reply to review", x: 0.66, y: 0.71 },
  { label: "Tidy stockroom", x: 0.22, y: 0.19 },
  { label: "Rota for June", x: 0.35, y: 0.62 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eisenhower Matrix</CardTitle>
        <CardDescription>Urgent against important.</CardDescription>
      </CardHeader>
      <CardContent>
        <QuadrantMatrix items={items} xLabel="Urgency" yLabel="Importance"
          quadrants={["Schedule", "Do now", "Delegate", "Drop"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two things to do first <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
