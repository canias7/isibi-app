import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AqiBand } from "@/components/charts/lib/airquality"
const pollutants = [
  {
    name: "PM₂.₅", concentration: 21.4, unit: "µg/m³",
    breakpoints: [[0, 12, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 150.4, 151, 200]] as [number, number, number, number][],
  },
  {
    name: "PM₁₀", concentration: 44, unit: "µg/m³",
    breakpoints: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200]] as [number, number, number, number][],
  },
  {
    name: "Ozone", concentration: 0.086, unit: "ppm",
    breakpoints: [[0, 0.054, 0, 50], [0.055, 0.07, 51, 100], [0.071, 0.085, 101, 150], [0.086, 0.105, 151, 200]] as [number, number, number, number][],
  },
  {
    name: "NO₂", concentration: 62, unit: "ppb",
    breakpoints: [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150], [361, 649, 151, 200]] as [number, number, number, number][],
  },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Air quality index</CardTitle>
        <CardDescription>The worst sub-index sets it, not an average</CardDescription>
      </CardHeader>
      <CardContent>
        <AqiBand pollutants={pollutants} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ozone is driving the number today <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Interpolated breakpoints
        </div>
      </CardFooter>
    </Card>
  )
}
