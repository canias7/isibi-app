import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SkewT } from "@/components/charts/lib/weather2"
const levels = [
  { hPa: 1000, tempC: 22, dewC: 15 },
  { hPa: 950, tempC: 18, dewC: 13 },
  { hPa: 900, tempC: 14, dewC: 12.4 },
  { hPa: 850, tempC: 11, dewC: 10 },
  { hPa: 800, tempC: 8, dewC: 4 },
  { hPa: 700, tempC: 1, dewC: -7 },
  { hPa: 600, tempC: -7, dewC: -16 },
  { hPa: 500, tempC: -17, dewC: -27 },
  { hPa: 400, tempC: -30, dewC: -41 },
  { hPa: 300, tempC: -46, dewC: -58 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atmospheric sounding</CardTitle>
        <CardDescription>Temperature and dew point with height</CardDescription>
      </CardHeader>
      <CardContent>
        <SkewT levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The traces close where cloud forms <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Midday ascent
        </div>
      </CardFooter>
    </Card>
  )
}
