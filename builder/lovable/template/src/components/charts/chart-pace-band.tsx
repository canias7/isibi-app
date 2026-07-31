import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PaceBand } from "@/components/charts/lib/fitness"
let s = 19
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const segments = Array.from({ length: 21 }, (_, i) => {
  const km = i + 1
  const grade = km > 12 && km < 16 ? 4.2 : km > 17 && km < 19 ? -2.8 : Math.sin(km / 5) * 1.4
  const fade = km > 16 ? (km - 16) * 1.9 : 0
  return {
    km,
    paceSecPerKm: Math.round(266 + grade * 7 + fade + (rnd() - 0.5) * 8),
    note: km === 14 ? "Long climb" : km === 18 ? "Descent" : undefined,
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pace band</CardTitle>
        <CardDescription>Split pace against the target line</CardDescription>
      </CardHeader>
      <CardContent>
        <PaceBand segments={segments} targetMinutes={94} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The climb at 14 km is where the plan slips <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Half marathon
        </div>
      </CardFooter>
    </Card>
  )
}
