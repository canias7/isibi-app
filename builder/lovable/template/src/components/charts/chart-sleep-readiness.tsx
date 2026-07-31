import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SleepReadiness } from "@/components/charts/lib/fitness"
let s = 88
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const days = Array.from({ length: 14 }, (_, i) => {
  const short = i >= 6 && i <= 8
  return {
    date: `D${i + 1}`,
    sleepHours: +(short ? 5.6 + rnd() * 0.5 : 7.4 + rnd() * 0.9).toFixed(1),
    restingHr: Math.round(short ? 58 + rnd() * 4 : 51 + rnd() * 3),
    hrvMs: Math.round(short ? 52 + rnd() * 8 : 71 + rnd() * 9),
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Readiness</CardTitle>
        <CardDescription>Sleep, resting heart rate and HRV against baseline</CardDescription>
      </CardHeader>
      <CardContent>
        <SleepReadiness days={days} baseline={{ sleepHours: 7.8, restingHr: 52, hrvMs: 74 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three nights short and HRV followed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Fourteen nights
        </div>
      </CardFooter>
    </Card>
  )
}
