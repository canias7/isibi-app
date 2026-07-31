import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VehicleIdle } from "@/components/charts/lib/taxi"
const vehicles = [
  { name: "Plate 4412", engagedHours: 9.4, availableHours: 3.1, fares: 268 },
  { name: "Plate 4418", engagedHours: 7.2, availableHours: 5.6, fares: 204 },
  { name: "Plate 4423", engagedHours: 5.1, availableHours: 8.4, fares: 148 },
  { name: "Plate 4431", engagedHours: 10.6, availableHours: 2.2, fares: 312 },
  { name: "Plate 4436", engagedHours: 3.8, availableHours: 4.1, fares: 109 },
  { name: "Plate 4440", engagedHours: 6.4, availableHours: 9.2, fares: 181 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle day</CardTitle>
        <CardDescription>The band a trips report cannot show</CardDescription>
      </CardHeader>
      <CardContent>
        <VehicleIdle vehicles={vehicles} dayHours={24} standingCostPerDay={38} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Financed by the month, earning by the minute <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six vehicles
        </div>
      </CardFooter>
    </Card>
  )
}
