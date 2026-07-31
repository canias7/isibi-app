import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PowderReuse } from "@/components/charts/lib/additive"
const make = (name: string, ox0: number, oxRate: number, sp0: number, spRate: number, n: number) => ({
  name,
  cycles: Array.from({ length: n }, (_, i) => ({
    cycle: i,
    oxygenPpm: Math.round(ox0 + oxRate * i),
    sphericity: Math.round((sp0 - spRate * i) * 1000) / 1000,
  })),
})
const lots = [
  make("Lot A · virgin blend", 620, 34, 0.948, 0.0026, 9),
  make("Lot B · sieved", 780, 41, 0.936, 0.0031, 11),
  make("Lot C · high reuse", 1080, 38, 0.918, 0.0044, 13),
  make("Lot D · new", 540, 29, 0.955, 0.0019, 5),
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Powder reuse</CardTitle>
        <CardDescription>Two limits, and which one binds</CardDescription>
      </CardHeader>
      <CardContent>
        <PowderReuse lots={lots} maxOxygenPpm={1500} minSphericity={0.88} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Powder is discarded on a fixed number of reuses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four lots
        </div>
      </CardFooter>
    </Card>
  )
}
