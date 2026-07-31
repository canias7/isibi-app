import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CrewFatigue } from "@/components/charts/lib/emergency"
const shifts = [
  { day: "Mon", startHour: 7, hours: 12, night: false, restBeforeHours: 48 },
  { day: "Tue", startHour: 7, hours: 12, night: false, restBeforeHours: 12 },
  { day: "Wed", startHour: 19, hours: 12, night: true, restBeforeHours: 24 },
  { day: "Thu", startHour: 19, hours: 12, night: true, restBeforeHours: 12 },
  { day: "Fri", startHour: 19, hours: 12, night: true, restBeforeHours: 12 },
  { day: "Sat", startHour: 19, hours: 12, night: true, restBeforeHours: 12 },
  { day: "Sun", startHour: 7, hours: 12, night: false, restBeforeHours: 9 },
  { day: "Mon", startHour: 7, hours: 12, night: false, restBeforeHours: 12 },
  { day: "Tue", startHour: 7, hours: 8, night: false, restBeforeHours: 36 },
  { day: "Wed", startHour: 19, hours: 12, night: true, restBeforeHours: 28 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatigue</CardTitle>
        <CardDescription>Accumulated, and only partly recovered</CardDescription>
      </CardHeader>
      <CardContent>
        <CrewFatigue shifts={shifts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rota that passes every rule can still end badly <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One roster block
        </div>
      </CardFooter>
    </Card>
  )
}
