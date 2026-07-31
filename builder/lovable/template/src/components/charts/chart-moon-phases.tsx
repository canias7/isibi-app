import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClimateChart, TideChart, DaylightBand, TemperatureBands, Hyetograph, ElevationProfile, SunPath, MoonPhases } from "./lib/earth"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moon Phases</CardTitle>
        <CardDescription>A month of discs through the cycle.</CardDescription>
      </CardHeader>
      <CardContent>
        <MoonPhases startPhase={0} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Full on the sixteenth <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
