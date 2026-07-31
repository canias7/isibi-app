import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PhillipsCurve } from "@/components/charts/lib/econ"
const points = Array.from({ length: 22 }, (_, i) => {
  const year = 2002 + i
  const shift = i < 8 ? 0 : (i - 8) * 0.28
  const u = 5.4 + Math.sin(i / 2.6) * 2.1 + shift * 0.4
  return { year, unemployment: Number(u.toFixed(1)), inflation: Number((9.2 - u * 1.05 + shift).toFixed(1)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unemployment and inflation</CardTitle>
        <CardDescription>Joined in year order</CardDescription>
      </CardHeader>
      <CardContent>
        <PhillipsCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The loop is the curve shifting <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Two decades
        </div>
      </CardFooter>
    </Card>
  )
}
