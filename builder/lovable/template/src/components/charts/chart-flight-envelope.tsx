import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FlightEnvelope } from "@/components/charts/lib/aero"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>V-n diagram</CardTitle>
        <CardDescription>Load factor against airspeed</CardDescription>
      </CardHeader>
      <CardContent>
        <FlightEnvelope stallSpeed={52} maxSpeed={185} positiveLimit={4.4} negativeLimit={-1.8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Corner speed is where the two limits meet <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Utility category
        </div>
      </CardFooter>
    </Card>
  )
}
