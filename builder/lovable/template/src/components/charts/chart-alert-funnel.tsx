import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertFunnel } from "@/components/charts/lib/socops"
const stages = [
  { name: "Raw signals", count: 4_120_000 },
  { name: "Correlated alerts", count: 38_400 },
  { name: "Triaged by an analyst", count: 6_150 },
  { name: "Escalated", count: 412 },
  { name: "Confirmed incidents", count: 27 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert triage</CardTitle>
        <CardDescription>Conversion at each stage, and the cost of the noise</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertFunnel stages={stages} minutesPerTriage={11} analystCostPerHour={64} triagedStage="Correlated alerts" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The steepest drop is where a rule change pays <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
