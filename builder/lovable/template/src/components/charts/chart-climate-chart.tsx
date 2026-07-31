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

const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
const tempC = [5, 6, 9, 12, 16, 19, 22, 21, 17, 13, 8, 5]
const precipMm = [78, 60, 54, 48, 44, 38, 30, 34, 52, 74, 82, 88]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Climate Chart</CardTitle>
        <CardDescription>The Walter-Lieth pairing of °C and mm.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClimateChart months={months} tempC={tempC} precipMm={precipMm} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two dry months in high summer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
