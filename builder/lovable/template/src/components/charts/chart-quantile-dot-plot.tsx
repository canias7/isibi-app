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

const quantiles = Array.from({ length: 400 }, (_, i) => {
  const p = (i + 0.5) / 400
  return 8.4 + Math.log(p / (1 - p)) * 0.32 + 0.5
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quantile Dot Plot</CardTitle>
        <CardDescription>Twenty equally likely outcomes, countable.</CardDescription>
      </CardHeader>
      <CardContent>
        <QuantileDotPlot quantiles={quantiles} threshold={9.08} format={(n) => n.toFixed(2)} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Four of twenty arrive after 9:05 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
