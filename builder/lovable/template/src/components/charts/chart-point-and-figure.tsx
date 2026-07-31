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
        <CardTitle>Point and Figure</CardTitle>
        <CardDescription>Columns of X and O with a three-box reversal.</CardDescription>
      </CardHeader>
      <CardContent>
        <PointAndFigure values={prices} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Four reversals in the period <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
