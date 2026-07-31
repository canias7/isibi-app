import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartRank } from "@/components/charts/lib/podcast"
let s = 271
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const walk = (start: number, drift: number, dropout: number) => {
  let r = start
  return Array.from({ length: 60 }, () => {
    r = Math.max(1, Math.round(r * (1 + drift + (rnd() - 0.5) * 0.22)))
    return r > 200 || rnd() < dropout ? null : r
  })
}
const shows = [
  { name: "Ours", ranks: walk(96, -0.021, 0.01) },
  { name: "Rival A", ranks: walk(24, 0.006, 0.005) },
  { name: "Rival B", ranks: walk(150, 0.004, 0.12) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart position</CardTitle>
        <CardDescription>Inverted and logarithmic, so up is better</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartRank shows={shows} maxRank={200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A linear rank axis points the wrong way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Sixty days
        </div>
      </CardFooter>
    </Card>
  )
}
