import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PolarDiagram } from "@/components/charts/lib/sailing"
const angles = [30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180]
// the wind speed has to enter the SHAPE, not just scale it — a model where it is
// only a multiplier puts every optimum at the same angle, which is the one thing
// this chart exists to deny
const model = (tws: number) =>
  angles.map((a) => {
    const rad = (a * Math.PI) / 180
    const run = (1 - Math.cos(rad)) / 2
    // a running sail projects area, so drive does not vanish dead downwind
    const drive = Math.pow(Math.sin(rad), 0.62) * 0.72 + run * 0.5
    // the penalty for sailing deep is worst in light air
    const deep = 1 - Math.pow(run, 2.6) * (tws < 12 ? 0.72 : tws < 18 ? 0.4 : 0.18)
    // and a boat cannot point until it has flow, which needs breeze
    const point = a >= 60 ? 1 : Math.pow(a / 60, tws < 12 ? 5.5 : tws < 18 ? 2.2 : 0.8)
    return Math.round(Math.min(tws * 0.55, 8.6) * drive * deep * point * 100) / 100
  })
const windSpeeds = [8, 14, 20]
const speeds = windSpeeds.map(model)
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Boat polar</CardTitle>
        <CardDescription>Fastest and best VMG are different angles</CardDescription>
      </CardHeader>
      <CardContent>
        <PolarDiagram windSpeeds={windSpeeds} angles={angles} speeds={speeds} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The optimum angles move with the wind speed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three wind strengths
        </div>
      </CardFooter>
    </Card>
  )
}
