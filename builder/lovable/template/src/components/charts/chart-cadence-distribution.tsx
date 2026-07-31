import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CadenceDistribution } from "@/components/charts/lib/cycling"
const bins = [
  { rpm: 50, minutes: 8 }, { rpm: 60, minutes: 21 }, { rpm: 70, minutes: 42 },
  { rpm: 80, minutes: 68 }, { rpm: 90, minutes: 74 }, { rpm: 100, minutes: 31 },
  { rpm: 110, minutes: 9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadence</CardTitle>
        <CardDescription>Time at each cadence, and the torque it implies</CardDescription>
      </CardHeader>
      <CardContent>
        <CadenceDistribution bins={bins} averagePower={245} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Knee load does not appear in a power figure <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          245 W average
        </div>
      </CardFooter>
    </Card>
  )
}
