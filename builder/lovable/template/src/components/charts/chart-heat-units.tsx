import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeatUnits } from "@/components/charts/lib/horticulture"
let s = 66
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const days = Array.from({ length: 74 }, (_, d) => {
  const base = 12 + d * 0.18 + (rnd() - 0.5) * 5
  return { min: base - 5, max: base + 8 }
})
const stages = [
  { name: "Emergence", gdd: 100 },
  { name: "6 leaves", gdd: 330 },
  { name: "Tasselling", gdd: 700 },
  { name: "Silking", gdd: 800 },
  { name: "Black layer", gdd: 1350 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growing degree days</CardTitle>
        <CardDescription>Each stage forecast from the current rate</CardDescription>
      </CardHeader>
      <CardContent>
        <HeatUnits days={days} baseC={10} stages={stages} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A cold snap moves every date together <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Maize, base 10 °C
        </div>
      </CardFooter>
    </Card>
  )
}
