import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FanCurve } from "@/components/charts/lib/hvac"
const fan = Array.from({ length: 13 }, (_, i) => {
  const ls = i * 300
  return { ls, pa: Math.round(1150 - Math.pow(ls / 3600, 2) * 980 - ls * 0.048) }
})
// k is chosen so the design curve crosses the fan curve AT the duty — the
// fan gives 599 Pa at 2,400 l/s, and 599 / 2400² is 1.04e-4
const systems = [
  { name: "As designed", k: 0.000104 },
  { name: "Filters at change point", k: 0.000142 },
  { name: "Damper 30% shut", k: 0.000186 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating point</CardTitle>
        <CardDescription>Where the fan curve meets the ductwork</CardDescription>
      </CardHeader>
      <CardContent>
        <FanCurve fan={fan} systems={systems} dutyLs={2400} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Resistance goes with the square of flow <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Duty 2,400 l/s
        </div>
      </CardFooter>
    </Card>
  )
}
