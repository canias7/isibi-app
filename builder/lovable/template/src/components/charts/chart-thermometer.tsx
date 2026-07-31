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
        <CardTitle>Thermometer</CardTitle>
        <CardDescription>Progress towards a goal.</CardDescription>
      </CardHeader>
      <CardContent>
        <Thermometer value={8420} goal={12500} milestones={[3000, 6000, 9000, 12000]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          68% of the way there <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
