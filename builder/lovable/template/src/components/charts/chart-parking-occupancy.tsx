import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ParkingOccupancy } from "@/components/charts/lib/transit2"
const hours = ["08","09","10","11","12","13","14","15","16","17","18","19"]
const shape = (peak: number, spread: number) =>
  hours.map((_, i) => Math.round(peak * Math.exp(-Math.pow((i - 5) / spread, 2)) * 100) / 100)
const blocks = [
  { name: "High St 100 block", spaces: 24, occupied: shape(0.98, 4.4).map((f) => f * 24) },
  { name: "High St 200 block", spaces: 18, occupied: shape(1.02, 3.6).map((f) => f * 18) },
  { name: "Church Ln", spaces: 12, occupied: shape(0.72, 3.1).map((f) => f * 12) },
  { name: "Mill Rd", spaces: 30, occupied: shape(0.61, 5.2).map((f) => f * 30) },
  { name: "Station approach", spaces: 16, occupied: shape(0.88, 6).map((f) => f * 16) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kerbside occupancy</CardTitle>
        <CardDescription>Blocks at or above practical capacity</CardDescription>
      </CardHeader>
      <CardContent>
        <ParkingOccupancy blocks={blocks} hours={hours} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nine block-hours of circling a day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weekday, 08:00–20:00
        </div>
      </CardFooter>
    </Card>
  )
}
