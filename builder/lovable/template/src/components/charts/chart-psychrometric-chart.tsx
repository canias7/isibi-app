import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PsychrometricChart } from "@/components/charts/lib/hvac"
const readings = [
  { name: "Open plan north", dryBulbC: 22.4, rhPercent: 46 },
  { name: "Open plan south", dryBulbC: 24.8, rhPercent: 58 },
  { name: "Meeting 1", dryBulbC: 23.1, rhPercent: 68 },
  { name: "Meeting 2", dryBulbC: 21.6, rhPercent: 30 },
  { name: "Reception", dryBulbC: 20.2, rhPercent: 52 },
  { name: "Server room", dryBulbC: 19.1, rhPercent: 24 },
  { name: "Canteen", dryBulbC: 25.6, rhPercent: 64 },
  { name: "Studio", dryBulbC: 23.4, rhPercent: 44 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comfort envelope</CardTitle>
        <CardDescription>Humidity ratio computed, not assumed</CardDescription>
      </CardHeader>
      <CardContent>
        <PsychrometricChart
          readings={readings}
          comfort={{ tC: [20, 24], wGkg: [5.5, 11.5] }}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The complaint a thermostat cannot answer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight rooms, one afternoon
        </div>
      </CardFooter>
    </Card>
  )
}
