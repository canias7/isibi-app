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
  { label: "Champions", x: 0.86, y: 0.88, size: 240 },
  { label: "Loyal", x: 0.68, y: 0.72, size: 180 },
  { label: "Promising", x: 0.74, y: 0.31, size: 90 },
  { label: "At risk", x: 0.26, y: 0.66, size: 130 },
  { label: "Hibernating", x: 0.18, y: 0.22, size: 45 },
  { label: "New", x: 0.9, y: 0.12, size: 38 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RFM Grid</CardTitle>
        <CardDescription>Recency against frequency, bubble by spend.</CardDescription>
      </CardHeader>
      <CardContent>
        <QuadrantMatrix items={items} xLabel="Recency" yLabel="Frequency" bubble
          quadrants={["At risk", "Champions", "New", "Hibernating"]} format={(n) => "£" + n} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Champions are the top right <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
