import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LightCurve } from "@/components/charts/lib/aero"
let s = 7
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 0.012
const points = Array.from({ length: 340 }, (_, i) => {
  const time = i * 0.0271
  const ph = (time % 2.87) / 2.87
  const primary = 0.42 * Math.exp(-((ph - 0.25) ** 2) / 0.0009)
  const secondary = 0.17 * Math.exp(-((ph - 0.75) ** 2) / 0.0011)
  return { time, mag: 8.4 + primary + secondary + rnd() }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eclipsing binary</CardTitle>
        <CardDescription>Brightness folded on the period</CardDescription>
      </CardHeader>
      <CardContent>
        <LightCurve points={points} period={2.87} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two dips a cycle, unequal depth <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Phase-folded
        </div>
      </CardFooter>
    </Card>
  )
}
