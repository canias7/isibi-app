import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SolarPath } from "@/components/charts/lib/building"
const dates = [
  { name: "Summer solstice", dayOfYear: 172 },
  { name: "Equinox", dayOfYear: 80 },
  { name: "Winter solstice", dayOfYear: 355 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sun path</CardTitle>
        <CardDescription>Altitude computed from latitude and declination</CardDescription>
      </CardHeader>
      <CardContent>
        <SolarPath latitude={51.5} dates={dates} obstructionAltitude={18} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The building opposite takes the winter sun <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          51.5° N
        </div>
      </CardFooter>
    </Card>
  )
}
