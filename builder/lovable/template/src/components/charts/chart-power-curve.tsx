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

const points = Array.from({ length: 40 }, (_, i) => {
  const n = 40 + i * 20
  return { n, power: 1 - Math.exp(-n / 200) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Curve</CardTitle>
        <CardDescription>Power against sample size.</CardDescription>
      </CardHeader>
      <CardContent>
        <PowerCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The marked size reaches 80% power <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
