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

const r = rnd(67)
const points = Array.from({ length: 80 }, () => ({
  fitted: 20 + r() * 60,
  residual: (r() + r() - 1) * 14,
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Residual Plot</CardTitle>
        <CardDescription>What the model missed.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResidualPlot points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          No pattern — the fit is honest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
