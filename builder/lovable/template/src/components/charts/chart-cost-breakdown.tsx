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

const parts = [
  { label: "Staff", value: 3610 },
  { label: "Rent", value: 1800 },
  { label: "Stock", value: 880 },
  { label: "Utilities", value: 420 },
  { label: "Marketing", value: 240 },
  { label: "Other", value: 170 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
        <CardDescription>Where the month's money went.</CardDescription>
      </CardHeader>
      <CardContent>
        <CostBreakdown parts={parts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Staff is over half <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
