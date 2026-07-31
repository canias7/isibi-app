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

const values = Array.from({ length: 120 }, (_, i) => 40 + Math.sin((i / 7) * Math.PI * 2) * 14 + (i % 3))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Correlogram</CardTitle>
        <CardDescription>How much each week predicts the next.</CardDescription>
      </CardHeader>
      <CardContent>
        <Correlogram values={values} lags={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A clear weekly cycle at lag 7 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
