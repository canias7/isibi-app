import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookingWindow } from "@/components/charts/lib/hotel"
const buckets = [
  { fromDays: 90, toDays: 180, bookings: 84 },
  { fromDays: 45, toDays: 90, bookings: 162 },
  { fromDays: 21, toDays: 45, bookings: 248 },
  { fromDays: 14, toDays: 21, bookings: 196 },
  { fromDays: 7, toDays: 14, bookings: 214 },
  { fromDays: 3, toDays: 7, bookings: 178 },
  { fromDays: 0, toDays: 3, bookings: 142 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead time</CardTitle>
        <CardDescription>How much of a normal week is still to come</CardDescription>
      </CardHeader>
      <CardContent>
        <BookingWindow buckets={buckets} daysToArrival={14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two fifths of the bookings have not happened yet <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          14 days out
        </div>
      </CardFooter>
    </Card>
  )
}
