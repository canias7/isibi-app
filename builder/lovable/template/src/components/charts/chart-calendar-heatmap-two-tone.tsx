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

const days = sampleDays(182, 21)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Heatmap</CardTitle>
        <CardDescription>Bookings per day, in brand colour.</CardDescription>
      </CardHeader>
      <CardContent>
        <CalendarHeatmap days={days} levels={["var(--muted)", "color-mix(in oklch, var(--chart-1) 25%, var(--muted))", "color-mix(in oklch, var(--chart-1) 50%, var(--muted))", "color-mix(in oklch, var(--chart-1) 75%, var(--muted))", "var(--chart-1)"]} />
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
