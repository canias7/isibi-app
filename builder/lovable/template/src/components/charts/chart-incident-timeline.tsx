import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Yamazumi, TaktTime, Fishbone, RaciMatrix, SkillsMatrix, RotaChart, IncidentTimeline, DefectConcentration } from "./lib/lean"

const incidents = [
  { at: 3, label: "Till offline", severity: 2 as const, minutes: 35 },
  { at: 9, label: "Booking outage", severity: 3 as const, minutes: 95 },
  { at: 14, label: "Slow site", severity: 1 as const, minutes: 20 },
  { at: 21, label: "Payment failure", severity: 3 as const, minutes: 70 },
  { at: 26, label: "Email bounce", severity: 1 as const, minutes: 15 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Incident Timeline</CardTitle>
        <CardDescription>Severity and how long recovery took.</CardDescription>
      </CardHeader>
      <CardContent>
        <IncidentTimeline incidents={incidents} span={[0, 30]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          MTTR is under an hour <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
