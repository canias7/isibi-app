import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RouteDensity } from "@/components/charts/lib/waste"
const rounds = [
  { name: "12 — high-rise", properties: 1840, routeKm: 11, hours: 7.5 },
  { name: "4 — terraces", properties: 1210, routeKm: 18, hours: 7.5 },
  { name: "9 — semis", properties: 890, routeKm: 26, hours: 7.5 },
  { name: "1 — suburban", properties: 640, routeKm: 34, hours: 7.5 },
  { name: "7 — village", properties: 380, routeKm: 52, hours: 8 },
  { name: "14 — scattered", properties: 190, routeKm: 71, hours: 8 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Round density</CardTitle>
        <CardDescription>Cost per lift against properties per kilometre</CardDescription>
      </CardHeader>
      <CardContent>
        <RouteDensity rounds={rounds} vehicleCostPerHour={78} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rural round drives between bins <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          £78/hour
        </div>
      </CardFooter>
    </Card>
  )
}
