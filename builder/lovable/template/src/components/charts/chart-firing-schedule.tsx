import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FiringSchedule } from "@/components/charts/lib/ceramics"
const segments = [
  { name: "Water smoking", toC: 200, hours: 4 },
  { name: "Organics burn", toC: 600, hours: 4, holdHours: 0.25 },
  { name: "Quartz inversion", toC: 620, hours: 0.5 },
  { name: "Climb", toC: 1000, hours: 2 },
  { name: "Soak", toC: 1000, hours: 0, holdHours: 0.5 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firing schedule</CardTitle>
        <CardDescription>Programmed in hours, survived in degrees per hour</CardDescription>
      </CardHeader>
      <CardContent>
        <FiringSchedule segments={segments} startC={20} maxRampC={150} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The controller is asked for a rate nobody typed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bisque to 1000°C
        </div>
      </CardFooter>
    </Card>
  )
}
