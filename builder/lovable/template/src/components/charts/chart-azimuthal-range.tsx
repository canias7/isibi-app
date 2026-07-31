import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AzimuthalRange } from "@/components/charts/lib/carto"
const places = [
  { label: "Northgate", bearing: 12, distance: 18 },
  { label: "Eastfield", bearing: 88, distance: 34 },
  { label: "Harbour", bearing: 141, distance: 52 },
  { label: "Southmoor", bearing: 194, distance: 27 },
  { label: "Westbrook", bearing: 268, distance: 44 },
  { label: "Fell Rise", bearing: 321, distance: 61 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery radius</CardTitle>
        <CardDescription>Bearing and distance from the depot</CardDescription>
      </CardHeader>
      <CardContent>
        <AzimuthalRange origin="Depot" places={places} rings={[20, 40, 60]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everything inside 40 km is same-day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Straight-line distance
        </div>
      </CardFooter>
    </Card>
  )
}
