import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClimbProfile } from "@/components/charts/lib/cycling"
// the elevation is INTEGRATED from a gradient, never multiplied — scaling a
// cumulative height by a per-section factor puts a cliff at every boundary
const points = (() => {
  const n = 48
  const step = 9.4 / (n - 1)
  const gradeAt = (km: number) =>
    km > 4.2 && km < 6.1 ? 0.148 : km > 7.4 && km < 8.0 ? 0.012 : 0.078
  let elevationM = 520
  const out = [{ km: 0, elevationM }]
  for (let i = 1; i < n; i++) {
    elevationM += gradeAt((i - 0.5) * step) * step * 1000
    out.push({ km: i * step, elevationM: elevationM + Math.sin(i * step * 2.1) * 4 })
  }
  return out
})()

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Climb profile</CardTitle>
        <CardDescription>Gradient from the elevation trace</CardDescription>
      </CardHeader>
      <CardContent>
        <ClimbProfile points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The average on the sign is not the hard part <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          9.4 km
        </div>
      </CardFooter>
    </Card>
  )
}
