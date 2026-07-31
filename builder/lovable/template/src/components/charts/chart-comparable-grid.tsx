import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ComparableGrid } from "@/components/charts/lib/realestate"
const comparables = [
  { address: "14 Fell Rise", price: 425000, sqm: 88, beds: 3, monthsAgo: 3 },
  { address: "7 Kiln Brook", price: 468000, sqm: 104, beds: 4, monthsAgo: 8 },
  { address: "22 Harbour View", price: 392000, sqm: 79, beds: 3, monthsAgo: 1 },
  { address: "3 Northgate", price: 510000, sqm: 118, beds: 4, monthsAgo: 11 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparable sales</CardTitle>
        <CardDescription>With the adjustments shown</CardDescription>
      </CardHeader>
      <CardContent>
        <ComparableGrid subject={{ address: "9 Mire Lane", sqm: 92, beds: 3 }} comparables={comparables} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Adjustments are the reasoning, not the inputs <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three beds, 92 m²
        </div>
      </CardFooter>
    </Card>
  )
}
