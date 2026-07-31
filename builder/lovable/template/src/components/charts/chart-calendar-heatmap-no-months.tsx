import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalendarHeatmap, sampleDays } from "./lib/calendar-heatmap"

const days = sampleDays(182, 13)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Heatmap</CardTitle>
        <CardDescription>Bookings per day.</CardDescription>
      </CardHeader>
      <CardContent>
        <CalendarHeatmap days={days} showMonths={false} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tuesdays are the quiet day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
