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

const assets = [
  { label: "Cash", risk: 1, ret: 2.1 },
  { label: "Bonds", risk: 4, ret: 3.8 },
  { label: "Property", risk: 9, ret: 6.2 },
  { label: "Equity", risk: 15, ret: 8.4 },
  { label: "Small cap", risk: 22, ret: 9.1 },
  { label: "Crypto", risk: 38, ret: 7.6 },
]
const frontier = [
  { risk: 1, ret: 2.1 }, { risk: 4, ret: 4.4 }, { risk: 9, ret: 6.6 },
  { risk: 15, ret: 8.4 }, { risk: 22, ret: 9.4 }, { risk: 38, ret: 10.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Efficient Frontier</CardTitle>
        <CardDescription>Risk against return, with the best of each.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <EfficientFrontier assets={assets} frontier={frontier} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two assets sit well below the line <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
