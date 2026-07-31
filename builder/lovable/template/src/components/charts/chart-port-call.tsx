import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PortCall } from "@/components/charts/lib/shipping"
const phases = [
  { name: "Anchorage waiting", hours: 21 },
  { name: "Pilot and inbound", hours: 3.5 },
  { name: "Berthing", hours: 1.5 },
  { name: "Awaiting gang", hours: 4 },
  { name: "Discharge", hours: 26, productive: true },
  { name: "Shift hatch / survey", hours: 3 },
  { name: "Load", hours: 19, productive: true },
  { name: "Documentation", hours: 2.5 },
  { name: "Unberth and outbound", hours: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Port call</CardTitle>
        <CardDescription>Every phase, and how little of it works cargo</CardDescription>
      </CardHeader>
      <CardContent>
        <PortCall phases={phases} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Waiting for a berth is the biggest slice <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Rotterdam
        </div>
      </CardFooter>
    </Card>
  )
}
