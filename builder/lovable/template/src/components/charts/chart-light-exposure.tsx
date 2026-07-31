import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LightExposure } from "@/components/charts/lib/museum"
const objects = [
  { name: "Watercolour, Cotman", lux: 50, hoursPerDay: 8, daysDisplayed: 112 },
  { name: "Silk banner", lux: 50, hoursPerDay: 8, daysDisplayed: 168 },
  { name: "Manuscript leaf", lux: 40, hoursPerDay: 6, daysDisplayed: 90 },
  { name: "Photograph, albumen", lux: 50, hoursPerDay: 8, daysDisplayed: 140 },
  { name: "Dyed textile fragment", lux: 30, hoursPerDay: 8, daysDisplayed: 200 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Light exposure</CardTitle>
        <CardDescription>Lux-hours, because the limit is a dose</CardDescription>
      </CardHeader>
      <CardContent>
        <LightExposure objects={objects} annualLimitLuxHours={50000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Halving the level buys twice the days <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          50,000 lux-hour class
        </div>
      </CardFooter>
    </Card>
  )
}
