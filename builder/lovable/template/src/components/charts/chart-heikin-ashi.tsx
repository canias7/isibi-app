import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Renko, PointAndFigure, HeikinAshi, VolumeProfile, YieldCurve, RollingCorrelation, RollingVolatility, EfficientFrontier, RiskReturnScatter, EquityDrawdown, walk } from "./lib/market"

const prices = walk(160, 100, 2.2, 7)
const bars = prices.slice(0, 40).map((c, i, a) => {
  const o = i === 0 ? c : a[i - 1]
  return { open: o, close: c, high: Math.max(o, c) + 1.1, low: Math.min(o, c) - 1.1 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heikin-Ashi</CardTitle>
        <CardDescription>Averaged candles — smoother, but not real prices.</CardDescription>
      </CardHeader>
      <CardContent>
        <HeikinAshi bars={bars} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The run of hollow bars is the trend <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
