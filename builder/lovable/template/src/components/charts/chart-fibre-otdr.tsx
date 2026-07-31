import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FibreOtdr } from "@/components/charts/lib/telecom"
const events = [
  { atKm: 0.02, kind: "connector" as const, lossDb: 0.4 },
  { atKm: 4.1, kind: "splice" as const, lossDb: 0.08 },
  { atKm: 8.6, kind: "splice" as const, lossDb: 0.11 },
  { atKm: 12.4, kind: "bend" as const, lossDb: 0.62 },
  { atKm: 15.9, kind: "splice" as const, lossDb: 0.07 },
  { atKm: 18.2, kind: "break" as const, lossDb: 0 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OTDR trace</CardTitle>
        <CardDescription>Every joint located and its loss summed</CardDescription>
      </CardHeader>
      <CardContent>
        <FibreOtdr lengthKm={24} attenuationDbPerKm={0.21} events={events} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fibre is broken at 18 km <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1550 nm
        </div>
      </CardFooter>
    </Card>
  )
}
