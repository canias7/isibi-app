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

const points = Array.from({ length: 21 }, (_, i) => {
  const population = i / 20
  return { population, uplift: 0.62 * Math.sin(Math.PI * Math.min(1, population * 1.55)) - population * 0.12 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uplift Curve</CardTitle>
        <CardDescription>Incremental effect from targeting the top slice.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpliftCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Peaks at the top 30% — go further and it reverses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
