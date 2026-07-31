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

const r = rnd(53)
const pairs = Array.from({ length: 60 }, () => {
  const a = 20 + r() * 70
  return { a, b: a + (r() + r() - 1) * 6 + 1.2 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bland-Altman</CardTitle>
        <CardDescription>Do the till and the booking system agree?</CardDescription>
      </CardHeader>
      <CardContent>
        <BlandAltman pairs={pairs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Small bias, no drift with size <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
