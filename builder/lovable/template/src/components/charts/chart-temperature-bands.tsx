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
const record = [
  { lo: -8, hi: 14 }, { lo: -7, hi: 16 }, { lo: -4, hi: 21 }, { lo: -1, hi: 25 },
  { lo: 2, hi: 28 }, { lo: 6, hi: 33 }, { lo: 9, hi: 37 }, { lo: 8, hi: 35 },
  { lo: 4, hi: 30 }, { lo: 0, hi: 25 }, { lo: -4, hi: 18 }, { lo: -7, hi: 15 },
]
const normal = [
  { lo: 1, hi: 8 }, { lo: 1, hi: 9 }, { lo: 3, hi: 12 }, { lo: 5, hi: 15 },
  { lo: 8, hi: 18 }, { lo: 11, hi: 21 }, { lo: 13, hi: 24 }, { lo: 13, hi: 23 },
  { lo: 10, hi: 20 }, { lo: 7, hi: 15 }, { lo: 4, hi: 11 }, { lo: 2, hi: 8 },
]
const actual = [6, 4, 9, 11, 14, 19, 25, 24, 16, 12, 7, 5]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Temperature Bands</CardTitle>
        <CardDescription>This year inside the normal and record ranges.</CardDescription>
      </CardHeader>
      <CardContent>
        <TemperatureBands months={months} record={record} normal={normal} actual={actual} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three months ran above normal <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
