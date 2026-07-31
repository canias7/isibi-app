import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StockCover } from "@/components/charts/lib/retail2"
const lines = [
  { sku: "Cotton tee, black", units: 412, weeklySales: 168 },
  { sku: "Cotton tee, white", units: 96, weeklySales: 140 },
  { sku: "Linen shirt", units: 380, weeklySales: 44 },
  { sku: "Wool scarf", units: 220, weeklySales: 6 },
  { sku: "Rain shell", units: 74, weeklySales: 31 },
  { sku: "Sun hat", units: 190, weeklySales: 0 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weeks of cover</CardTitle>
        <CardDescription>Stock against the rate it sells</CardDescription>
      </CardHeader>
      <CardContent>
        <StockCover lines={lines} reorderWeeks={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Units alone say nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reorder at four weeks
        </div>
      </CardFooter>
    </Card>
  )
}
