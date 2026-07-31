import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CancellationPoint } from "@/components/charts/lib/taxi"
const stages = [
  { name: "Before a driver accepted", cancelled: 412, meanDriverMinutes: 0, byRider: 386 },
  { name: "Driver accepted, not moving", cancelled: 168, meanDriverMinutes: 2, byRider: 121 },
  { name: "Driver en route", cancelled: 194, meanDriverMinutes: 9, byRider: 141 },
  { name: "Driver waiting at pickup", cancelled: 96, meanDriverMinutes: 14, byRider: 48 },
  { name: "No-show, timed out", cancelled: 61, meanDriverMinutes: 21, byRider: 6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where a booking dies</CardTitle>
        <CardDescription>Driver time, not a single rate</CardDescription>
      </CardHeader>
      <CardContent>
        <CancellationPoint stages={stages} bookings={8400} driverCostPerMinute={0.42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A fee at the wrong stage saves nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          8,400 bookings
        </div>
      </CardFooter>
    </Card>
  )
}
