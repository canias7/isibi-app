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

const intervals = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]
const rainfall = [2, 5, 24, 11, 4, 6, 2, 1]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hyetograph</CardTitle>
        <CardDescription>The storm, interval by interval.</CardDescription>
      </CardHeader>
      <CardContent>
        <Hyetograph intervals={intervals} rainfall={rainfall} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half the rain fell in one hour <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
