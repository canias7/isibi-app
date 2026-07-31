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

const points = [
  { km: 0, elevation: 120 }, { km: 2, elevation: 160 }, { km: 4, elevation: 150 },
  { km: 6, elevation: 240 }, { km: 8, elevation: 230 }, { km: 10, elevation: 310 },
  { km: 11.5, elevation: 520 }, { km: 13, elevation: 560 }, { km: 15, elevation: 430 },
  { km: 17, elevation: 300 }, { km: 19, elevation: 210 }, { km: 21, elevation: 140 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Elevation Profile</CardTitle>
        <CardDescription>The route, with the steep parts shaded.</CardDescription>
      </CardHeader>
      <CardContent>
        <ElevationProfile points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One hard climb at two thirds distance <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
