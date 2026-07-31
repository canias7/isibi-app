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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rolling Volatility</CardTitle>
        <CardDescription>Spread over a moving window.</CardDescription>
      </CardHeader>
      <CardContent>
        <RollingVolatility values={prices} window={16} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One clear burst of instability <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
