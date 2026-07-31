import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FreightIndex } from "@/components/charts/lib/shipping"
let s = 17
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
let v = 1400
const points = Array.from({ length: 104 }, (_, i) => {
  const shock = i === 34 ? 1.9 : i === 62 ? 0.62 : 1
  v = Math.max(320, v * shock * (1 + (rnd() - 0.5) * 0.16))
  return { label: `W${i + 1}`, value: Math.round(v) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Freight index</CardTitle>
        <CardDescription>The level, and the risk the level hides</CardDescription>
      </CardHeader>
      <CardContent>
        <FreightIndex points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Volatility is what a fixed rate is worth <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weekly, two years
        </div>
      </CardFooter>
    </Card>
  )
}
