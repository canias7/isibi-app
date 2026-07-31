import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IncidentTimeline } from "@/components/charts/lib/socops"
const events = [
  { name: "Initial access via VPN", atMinute: 0, phase: "compromise" as const },
  { name: "Lateral movement to jump host", atMinute: 340, phase: "compromise" as const },
  { name: "EDR alert on credential dumping", atMinute: 8600, phase: "detect" as const },
  { name: "Analyst picks up the case", atMinute: 8720, phase: "triage" as const },
  { name: "Accounts disabled, hosts isolated", atMinute: 10040, phase: "contain" as const },
  { name: "Persistence removed", atMinute: 12800, phase: "eradicate" as const },
  { name: "Services restored", atMinute: 16200, phase: "recover" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Incident timeline</CardTitle>
        <CardDescription>Dwell and response measured from the timestamps</CardDescription>
      </CardHeader>
      <CardContent>
        <IncidentTimeline events={events} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dwell was six times the response <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One incident
        </div>
      </CardFooter>
    </Card>
  )
}
