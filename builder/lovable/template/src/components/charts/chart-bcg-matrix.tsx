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
  { label: "Haircut", x: 0.82, y: 0.35, size: 412 },
  { label: "Beard", x: 0.64, y: 0.22, size: 266 },
  { label: "Colour", x: 0.28, y: 0.86, size: 184 },
  { label: "Towel", x: 0.41, y: 0.18, size: 139 },
  { label: "Kids", x: 0.19, y: 0.44, size: 88 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>BCG Matrix</CardTitle>
        <CardDescription>Growth against share, bubble by revenue.</CardDescription>
      </CardHeader>
      <CardContent>
        <QuadrantMatrix items={items} xLabel="Relative share" yLabel="Market growth" bubble
          quadrants={["Question mark", "Star", "Cash cow", "Dog"]} format={(n) => "£" + n} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is the question mark <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
