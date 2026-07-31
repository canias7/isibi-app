import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TiltYield } from "@/components/charts/lib/solar"
const tilts = [10, 20, 30, 40, 50]
const azimuths = [-90, -45, 0, 45, 90]
const best = { tilt: 36, az: 0 }
const yields = tilts.map((t) =>
  azimuths.map((a) => {
    const tl = 1 - Math.pow((t - best.tilt) / 62, 2)
    const al = 1 - Math.pow((a - best.az) / 138, 2)
    return Math.round(1040 * tl * al)
  }),
)
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orientation</CardTitle>
        <CardDescription>What a compromise roof costs</CardDescription>
      </CardHeader>
      <CardContent>
        <TiltYield tilts={tilts} azimuths={azimuths} yields={yields} roof={{ tilt: 30, azimuth: 45 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The surface is flat near the top <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          kWh/kWp, relative
        </div>
      </CardFooter>
    </Card>
  )
}
