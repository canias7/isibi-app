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
  { label: "Bookings", value: 268, target: 300 },
  { label: "Revenue", value: 8420, target: 7500, format: (n: number) => "£" + n.toLocaleString() },
  { label: "Repeat rate", value: 62, target: 55, format: (n: number) => n + "%" },
  { label: "No-shows", value: 14, target: 10, higherIsBetter: false },
  { label: "Rating", value: 4.6, target: 4.5, format: (n: number) => n.toFixed(1) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scorecard</CardTitle>
        <CardDescription>Every measure against its target.</CardDescription>
      </CardHeader>
      <CardContent>
        <Scorecard rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three of five met <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
