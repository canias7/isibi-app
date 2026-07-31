import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Trajectory } from "@/components/charts/lib/strategy"
const track = Array.from({ length: 90 }, (_, t) => {
  const slow = t > 34 && t < 52
  const s = t + (slow ? -(t - 34) * 0.72 : 0)
  return {
    t,
    x: 20 + s * 0.9 + Math.sin(s / 7) * 9,
    y: 12 + s * 0.55 + Math.cos(s / 5) * 6,
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery run</CardTitle>
        <CardDescription>Path with time marks</CardDescription>
      </CardHeader>
      <CardContent>
        <Trajectory points={track} markEvery={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Bunched dots are where it slowed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One vehicle, one morning
        </div>
      </CardFooter>
    </Card>
  )
}
