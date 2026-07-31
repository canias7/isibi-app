import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CoilLoadSplit } from "@/components/charts/lib/hvac"
const cases = [
  { name: "Design summer", ls: 3200, onCoilC: 28, onCoilRh: 52 },
  { name: "Humid overcast", ls: 3200, onCoilC: 24, onCoilRh: 82 },
  { name: "Dry heat", ls: 3200, onCoilC: 32, onCoilRh: 28 },
  { name: "Part load, wet", ls: 1800, onCoilC: 23, onCoilRh: 78 },
  { name: "Shoulder season", ls: 2400, onCoilC: 20, onCoilRh: 60 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coil load</CardTitle>
        <CardDescription>Sensible and latent, derived from the air</CardDescription>
      </CardHeader>
      <CardContent>
        <CoilLoadSplit cases={cases} supplyC={13} supplyRh={90} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A coil sized on the total leaves the room clammy <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Off coil 13°C, 90% RH
        </div>
      </CardFooter>
    </Card>
  )
}
