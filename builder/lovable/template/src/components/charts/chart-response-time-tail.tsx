import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ResponseTimeTail } from "@/components/charts/lib/emergency"
let s = 611
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
// a log-normal-ish draw, which is the shape a response distribution really has
const draw = (median: number, spread: number, n: number) =>
  Array.from({ length: n }, () => Math.round(median * Math.exp((rnd() + rnd() + rnd() - 1.5) * spread) * 10) / 10)
const categories = [
  { name: "Category 1 · immediate", times: draw(6.4, 0.62, 900), meanTargetMin: 7, p90TargetMin: 15 },
  { name: "Category 2 · emergency", times: draw(16.2, 0.74, 2400), meanTargetMin: 18, p90TargetMin: 25 },
  { name: "Category 3 · urgent", times: draw(52, 0.86, 1400), meanTargetMin: 60, p90TargetMin: 90 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Response times</CardTitle>
        <CardDescription>The whole distribution, not the mean</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponseTimeTail categories={categories} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nobody waiting is in the middle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
