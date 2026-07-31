import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Waterfall } from "./lib/waterfall"

const steps = [
  { label: "Visits", value: 1200, total: true },
  { label: "Bounced", value: -340 },
  { label: "No slot", value: -280 },
  { label: "Abandoned", value: -320 },
  { label: "Booked", value: 260, total: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall</CardTitle>
        <CardDescription>Visitors lost at each step, no connectors.</CardDescription>
      </CardHeader>
      <CardContent>
        <Waterfall steps={steps} showConnectors={false} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          22% reach a booking <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
