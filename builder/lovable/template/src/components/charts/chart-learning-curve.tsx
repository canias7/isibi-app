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
        <CardTitle>Learning Curve</CardTitle>
        <CardDescription>Unit cost falling with cumulative volume.</CardDescription>
      </CardHeader>
      <CardContent>
        <LearningCurve firstUnitCost={18} rate={0.85} units={128} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          15% cheaper each doubling <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
