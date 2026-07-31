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

const points = [
  { t: 0, surviving: 1, low: 1, high: 1 },
  { t: 1, surviving: 0.91, low: 0.87, high: 0.95 },
  { t: 2, surviving: 0.83, low: 0.77, high: 0.89 },
  { t: 3, surviving: 0.74, low: 0.67, high: 0.81 },
  { t: 5, surviving: 0.61, low: 0.52, high: 0.7 },
  { t: 7, surviving: 0.5, low: 0.4, high: 0.6 },
  { t: 9, surviving: 0.43, low: 0.32, high: 0.54 },
  { t: 12, surviving: 0.36, low: 0.24, high: 0.48 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Survival with Band</CardTitle>
        <CardDescription>A survival curve with its confidence band.</CardDescription>
      </CardHeader>
      <CardContent>
        <SurvivalBand points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half are still active at month seven <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
