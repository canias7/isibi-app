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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Break-Even</CardTitle>
        <CardDescription>Where revenue overtakes total cost.</CardDescription>
      </CardHeader>
      <CardContent>
        <BreakEven fixed={2400} variablePerUnit={4} pricePerUnit={24} maxUnits={260} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Break-even at 120 cuts a month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
