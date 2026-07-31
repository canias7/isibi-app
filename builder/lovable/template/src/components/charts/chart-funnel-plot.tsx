import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SurvivalCurve, ForestPlot, FunnelPlot, BlandAltman, ResidualPlot, Correlogram, LagPlot, RegressionBand, LoessPlot, BinScatter, RugPlot, DotHistogram, SentimentTimeline, NgramLadder, rnd } from "./lib/statistical"

const r = rnd(41)
const points = Array.from({ length: 34 }, () => {
  const precision = 0.15 + r() * 0.85
  const spread = (1 - precision) * 0.9
  return { effect: 0.2 + (r() + r() - 1) * spread, precision }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel Plot</CardTitle>
        <CardDescription>Effect against precision — a gap means bias.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <FunnelPlot points={points} centre={0.2} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Symmetric, so no obvious bias <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
