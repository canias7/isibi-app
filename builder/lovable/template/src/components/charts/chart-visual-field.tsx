import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VisualField } from "@/components/charts/lib/med2"
const points: { x: number; y: number; db: number }[] = []
for (let gx = -3; gx <= 3; gx++) {
  for (let gy = -3; gy <= 3; gy++) {
    const x = gx * 9, y = gy * 9
    if (Math.hypot(x, y) > 29) continue
    const blind = Math.hypot(x - 15, y - 1.5) < 5 ? 30 : 0
    const superior = y > 9 && x < 0 ? 9 : 0
    points.push({ x, y, db: Math.max(0, Math.round(31 - blind - superior - Math.hypot(x, y) * 0.08)) })
  }
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perimetry</CardTitle>
        <CardDescription>Sensitivity across the field</CardDescription>
      </CardHeader>
      <CardContent>
        <VisualField points={points} eye="right" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The dark patch at 15° is the blind spot <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Right eye, 30°
        </div>
      </CardFooter>
    </Card>
  )
}
