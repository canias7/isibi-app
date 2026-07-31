import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DockSchedule } from "@/components/charts/lib/logistics"
const doors = ["D1", "D2", "D3", "D4", "D5"]
const bookings = [
  { door: "D1", from: 6, to: 8, ref: "IN-4021", type: "inbound" },
  { door: "D1", from: 9, to: 11.5, ref: "IN-4025" },
  { door: "D1", from: 13, to: 15, ref: "OUT-812" },
  { door: "D2", from: 6.5, to: 9, ref: "IN-4022" },
  { door: "D2", from: 8.5, to: 10.5, ref: "IN-4031" },
  { door: "D3", from: 7, to: 12, ref: "OUT-806" },
  { door: "D3", from: 13.5, to: 17, ref: "OUT-819" },
  { door: "D4", from: 10, to: 12, ref: "IN-4040" },
  { door: "D5", from: 6, to: 7, ref: "OUT-801" },
  { door: "D5", from: 15, to: 18, ref: "OUT-830" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Doors through the shift</CardTitle>
        <CardDescription>Bookings and clashes</CardDescription>
      </CardHeader>
      <CardContent>
        <DockSchedule doors={doors} bookings={bookings} startHour={6} endHour={18} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Outlined blocks are double-booked <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          06:00 to 18:00
        </div>
      </CardFooter>
    </Card>
  )
}
