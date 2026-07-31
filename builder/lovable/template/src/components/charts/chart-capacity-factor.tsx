import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CapacityFactor } from "@/components/charts/lib/power"
const fleet = [
  { name: "Nuclear", nameplateMw: 5900, outputGwh: 41800 },
  { name: "Offshore wind", nameplateMw: 14200, outputGwh: 51900 },
  { name: "Onshore wind", nameplateMw: 14600, outputGwh: 33600 },
  { name: "Gas (CCGT)", nameplateMw: 31000, outputGwh: 90400 },
  { name: "Solar", nameplateMw: 15800, outputGwh: 14200 },
  { name: "Hydro", nameplateMw: 1900, outputGwh: 5400 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nameplate against output</CardTitle>
        <CardDescription>What each fleet actually generated</CardDescription>
      </CardHeader>
      <CardContent>
        <CapacityFactor fleet={fleet} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Gigawatts and energy are different claims <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Full year
        </div>
      </CardFooter>
    </Card>
  )
}
