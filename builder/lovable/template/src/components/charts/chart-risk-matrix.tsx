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
  { label: "Stylist off sick", likelihood: 3, impact: 2 },
  { label: "Till failure", likelihood: 1, impact: 3 },
  { label: "Supplier late", likelihood: 2, impact: 1 },
  { label: "Booking outage", likelihood: 2, impact: 3 },
  { label: "Bad review", likelihood: 3, impact: 1 },
  { label: "Flood", likelihood: 0, impact: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Matrix</CardTitle>
        <CardDescription>Likelihood against impact.</CardDescription>
      </CardHeader>
      <CardContent>
        <RiskMatrix items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One risk in the severe corner <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
