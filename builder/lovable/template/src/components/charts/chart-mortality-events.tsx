import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MortalityEvents } from "@/components/charts/lib/aquaculture"
let s = 447
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
let alive = 184000
const days = Array.from({ length: 90 }, (_, i) => {
  const day = i + 1
  const spike = day >= 44 && day <= 48 ? 14 : day >= 71 && day <= 73 ? 6 : 1
  const deaths = Math.round(alive * 0.00035 * spike * (0.6 + rnd() * 0.8))
  const row = { day, deaths, alive }
  alive -= deaths
  return row
})
const events = [{ day: 44, label: "storm" }, { day: 71, label: "treatment" }]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily mortality</CardTitle>
        <CardDescription>Excess over the background rate</CardDescription>
      </CardHeader>
      <CardContent>
        <MortalityEvents days={days} events={events} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A cumulative percentage buries the day it happened <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Ninety days
        </div>
      </CardFooter>
    </Card>
  )
}
