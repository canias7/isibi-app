import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReplicationLag } from "@/components/charts/lib/dbperf"
const mk = (base: number, spikeAt: number, spike: number) => ({
  points: Array.from({ length: 72 }, (_, i) => ({
    t: `${i}`,
    lagSec: Number((base * (1 + Math.sin(i / 7) * 0.35) + (Math.abs(i - spikeAt) < 4 ? spike : 0)).toFixed(3)),
  })),
})
const series = [
  { replica: "replica-a", ...mk(0.08, 40, 22) },
  { replica: "replica-b", ...mk(0.12, 41, 3) },
  { replica: "replica-c", ...mk(0.05, 99, 0) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Replica lag</CardTitle>
        <CardDescription>Seconds behind the primary</CardDescription>
      </CardHeader>
      <CardContent>
        <ReplicationLag series={series} thresholdSec={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Log axis, or only the incident shows <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six hours
        </div>
      </CardFooter>
    </Card>
  )
}
