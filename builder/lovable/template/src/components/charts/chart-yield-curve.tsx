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

const maturities = ["3m", "1y", "2y", "5y", "10y", "30y"]
const curves = [
  { label: "Last year", rates: [3.1, 3.4, 3.7, 4.0, 4.3, 4.5] },
  { label: "Now", rates: [4.6, 4.5, 4.3, 4.2, 4.25, 4.4] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield Curve</CardTitle>
        <CardDescription>Rate against maturity, with last year for comparison.</CardDescription>
      </CardHeader>
      <CardContent>
        <YieldCurve curves={curves} maturities={maturities} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Flatter than a year ago <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
