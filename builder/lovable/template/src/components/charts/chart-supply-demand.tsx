import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BreakEven, SupplyDemand, LearningCurve, PriceLadder, Thermometer, GaugeGrid, CostBreakdown } from "./lib/business"

const supply = Array.from({ length: 12 }, (_, i) => ({ q: i * 10, p: 8 + i * 3 }))
const demand = Array.from({ length: 12 }, (_, i) => ({ q: i * 10, p: 56 - i * 3.4 }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supply and Demand</CardTitle>
        <CardDescription>Where the two curves clear.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SupplyDemand supply={supply} demand={demand} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Clears around £26 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
