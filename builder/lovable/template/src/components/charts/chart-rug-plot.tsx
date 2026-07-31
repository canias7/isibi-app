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

const r = rnd(83)
const values = Array.from({ length: 120 }, () => {
  const v = r()
  return v < 0.55 ? 8 + v * 40 : 45 + (v - 0.55) * 90
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rug Plot</CardTitle>
        <CardDescription>One tick per booking, along the value axis.</CardDescription>
      </CardHeader>
      <CardContent>
        <RugPlot values={values} height={80} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A gap between £30 and £45 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
