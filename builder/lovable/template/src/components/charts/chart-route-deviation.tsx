import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RouteDeviation } from "@/components/charts/lib/shipping"
const routes = [
  { name: "Shanghai → Rotterdam", directNm: 10400, sailedNm: 13650, reason: "Cape routing, Red Sea avoided" },
  { name: "Santos → Qingdao", directNm: 11600, sailedNm: 11940, reason: "Weather routing" },
  { name: "Houston → Yokohama", directNm: 9200, sailedNm: 9880, reason: "Panama queue, Cape Horn" },
  { name: "Rotterdam → New York", directNm: 3320, sailedNm: 3410, reason: "Ice limit" },
  { name: "Dubai → Mombasa", directNm: 2380, sailedNm: 2660, reason: "Piracy corridor" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Route deviation</CardTitle>
        <CardDescription>Great-circle distance against what was sailed</CardDescription>
      </CardHeader>
      <CardContent>
        <RouteDeviation routes={routes} speedKnots={15} tonnesPerDay={58} fuelPricePerTonne={640} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The Cape adds three thousand miles <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          At 15 knots
        </div>
      </CardFooter>
    </Card>
  )
}
