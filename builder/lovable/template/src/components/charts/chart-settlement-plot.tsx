import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SettlementPlot } from "@/components/charts/lib/civil"
let s = 61
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const readings = Array.from({ length: 22 }, (_, i) => ({
  days: i * 7 + 1,
  mm: (18 * (1 - Math.exp(-(i * 7) / 62)) + (rnd() - 0.5) * 0.9),
}))
const predicted = Array.from({ length: 40 }, (_, i) => ({
  days: i * 7 + 1,
  mm: (18 * (1 - Math.exp(-(i * 7) / 62))),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement</CardTitle>
        <CardDescription>Measured settlement against the projection</CardDescription>
      </CardHeader>
      <CardContent>
        <SettlementPlot readings={readings} predicted={predicted} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The rate is still falling, as predicted <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weekly survey
        </div>
      </CardFooter>
    </Card>
  )
}
