import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuantileDotPlot, IconArray, SurvivalBand, CumulativeIncidence, SubgroupForest, DecisionCurve, UpliftCurve, PowerCurve } from "./lib/stats3"

const periods = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]
const outcomes = [
  { label: "Price", values: [0, 0.03, 0.06, 0.1, 0.14, 0.17, 0.2, 0.23, 0.25] },
  { label: "Moved away", values: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.11, 0.12, 0.13] },
  { label: "Service", values: [0, 0.01, 0.02, 0.03, 0.05, 0.06, 0.07, 0.08, 0.09] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Incidence</CardTitle>
        <CardDescription>Competing reasons for leaving, stacked.</CardDescription>
      </CardHeader>
      <CardContent>
        <CumulativeIncidence outcomes={outcomes} periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Price overtakes moving away by month six <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
