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

const levels = [
  { price: 52, volume: 120 }, { price: 50, volume: 210 }, { price: 48, volume: 380 },
  { price: 46, volume: 640 }, { price: 44, volume: 910 }, { price: 42, volume: 720 },
  { price: 40, volume: 430 }, { price: 38, volume: 260 }, { price: 36, volume: 140 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume Profile</CardTitle>
        <CardDescription>How much traded at each price.</CardDescription>
      </CardHeader>
      <CardContent>
        <VolumeProfile levels={levels} format={(n) => "£" + n} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most business sat at £44 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
