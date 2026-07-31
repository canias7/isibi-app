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

const rowLabels = ["Haircut", "Beard", "Colour", "Towel", "Kids", "Wash"]
const colLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const values = [
  [31, 24, 40, 52, 71, 88],
  [28, 22, 37, 48, 66, 81],
  [9, 12, 14, 18, 31, 44],
  [15, 11, 19, 24, 33, 41],
  [6, 5, 8, 11, 17, 38],
  [26, 20, 34, 44, 61, 76],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clustered Heatmap</CardTitle>
        <CardDescription>Rows reordered so similar services sit together.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClusteredHeatmap rowLabels={rowLabels} colLabels={colLabels} values={values} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cuts and beard behave alike <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
