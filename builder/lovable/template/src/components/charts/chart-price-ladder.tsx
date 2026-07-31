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

const tiers = [
  { label: "Trim", price: 14, note: "20 min" },
  { label: "Standard", price: 24, note: "35 min", highlight: true },
  { label: "Full", price: 38, note: "55 min" },
  { label: "Colour", price: 62, note: "95 min" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Ladder</CardTitle>
        <CardDescription>The tiers side by side.</CardDescription>
      </CardHeader>
      <CardContent>
        <PriceLadder tiers={tiers} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most people take Standard <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
