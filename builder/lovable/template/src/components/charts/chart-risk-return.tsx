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

const items = [
  { label: "Cuts", risk: 4, ret: 22, size: 412 },
  { label: "Beard", risk: 3, ret: 18, size: 266 },
  { label: "Colour", risk: 14, ret: 34, size: 184 },
  { label: "Towel", risk: 6, ret: 11, size: 139 },
  { label: "Kids", risk: 9, ret: 8, size: 88 },
  { label: "Events", risk: 21, ret: 29, size: 62 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk-Return</CardTitle>
        <CardDescription>Quadrants split at the medians.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <RiskReturnScatter items={items} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two services are high return and low risk <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
