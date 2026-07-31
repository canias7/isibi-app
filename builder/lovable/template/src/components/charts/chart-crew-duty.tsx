import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CrewDuty } from "@/components/charts/lib/aviation"
const duties = [
  { name: "Crew 1 · 04:30 report", reportHour: 4.5, sectors: 4, dutyHours: 11.2 },
  { name: "Crew 2 · 09:00 report", reportHour: 9, sectors: 2, dutyHours: 12.4 },
  { name: "Crew 3 · 06:15 report", reportHour: 6.25, sectors: 6, dutyHours: 11.8, commanderDiscretionHours: 1 },
  { name: "Crew 4 · 22:30 report", reportHour: 22.5, sectors: 2, dutyHours: 12.1 },
  { name: "Crew 5 · augmented", reportHour: 11, sectors: 1, dutyHours: 15.4, augmented: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flight duty period</CardTitle>
        <CardDescription>The limit derived from sectors and report time</CardDescription>
      </CardHeader>
      <CardContent>
        <CrewDuty duties={duties} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An early start costs ninety minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four crews
        </div>
      </CardFooter>
    </Card>
  )
}
