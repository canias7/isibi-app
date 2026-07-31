import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SetbackSchedule } from "@/components/charts/lib/hvac"
const days = [
  { name: "Mon", occupied: [8, 18] as [number, number], enabled: [5, 20] as [number, number] },
  { name: "Tue", occupied: [8, 18] as [number, number], enabled: [6, 19] as [number, number] },
  { name: "Wed", occupied: [8, 18] as [number, number], enabled: [6, 19] as [number, number] },
  { name: "Thu", occupied: [8, 18] as [number, number], enabled: [6, 19] as [number, number] },
  { name: "Fri", occupied: [8, 16] as [number, number], enabled: [6, 19] as [number, number] },
  { name: "Sat", occupied: [10, 13] as [number, number], enabled: [8, 16] as [number, number] },
  { name: "Sun", occupied: [0, 0] as [number, number], enabled: [0, 0] as [number, number] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setback</CardTitle>
        <CardDescription>Degree-hours, not hours</CardDescription>
      </CardHeader>
      <CardContent>
        <SetbackSchedule
          days={days}
          occupiedSetpoint={21}
          setbackSetpoint={14}
          outsideMeanC={7}
          kwhPerDegreeHour={2.4}
          pencePerKwh={9.8}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Preheat and overrun are where the next saving is <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          21°C occupied, 14°C back
        </div>
      </CardFooter>
    </Card>
  )
}
