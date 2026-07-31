import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FootfallByHour } from "@/components/charts/lib/libraries"
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"]
const openFrom = [9, 9, 9, 9, 9, 9, 24]
const openTo = [17, 19, 17, 19, 17, 16, 0]
const shape = [0.4, 0.8, 1, 0.9, 0.7, 0.9, 1.1, 1.2, 0.9, 0.7, 0.5]
const busy = [1, 0.9, 0.95, 1.05, 1.15, 1.4, 0.8]
const visits = days.map((_, di) =>
  hours.map((h, hi) => Math.round(38 * shape[hi] * busy[di] * (Number(h) >= openFrom[di] && Number(h) < openTo[di] ? 1 : 0.12))),
)
const staff = days.map((_, di) =>
  hours.map((h) => (Number(h) >= openFrom[di] && Number(h) < openTo[di] ? (Number(h) >= 12 && Number(h) < 15 ? 2 : 3) : 0)),
)
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Footfall</CardTitle>
        <CardDescription>Visits per staff hour, not visits</CardDescription>
      </CardHeader>
      <CardContent>
        <FootfallByHour days={days} hours={hours} visits={visits} staff={staff} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Opening hours are set by tradition <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week
        </div>
      </CardFooter>
    </Card>
  )
}
