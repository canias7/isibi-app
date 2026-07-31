import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookingPace } from "@/components/charts/lib/hotel"
const curve = (peak: number, shape: number) =>
  [120, 105, 90, 75, 60, 45, 35, 28, 21, 14, 10, 7, 4, 2, 0].map((daysOut) => ({
    daysOut,
    rooms: Math.round(peak / (1 + Math.exp((daysOut - shape) / 14))),
  }))
const thisYear = curve(186, 26)
const lastYear = curve(198, 38)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking pace</CardTitle>
        <CardDescription>Against the same days-out last year</CardDescription>
      </CardHeader>
      <CardContent>
        <BookingPace thisYear={thisYear} lastYear={lastYear} capacity={214} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gap was widest when the decision was due <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One arrival date
        </div>
      </CardFooter>
    </Card>
  )
}
