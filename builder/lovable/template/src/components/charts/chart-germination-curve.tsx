import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GerminationCurve } from "@/components/charts/lib/horticulture"
const mk = (final: number, t50: number, steep: number) =>
  Array.from({ length: 15 }, (_, d) => Math.round(final / (1 + Math.exp(-(d - t50) * steep))))
const lots = [
  { name: "Lot A · 2024", counts: mk(186, 4.2, 1.6) },
  { name: "Lot B · 2023", counts: mk(171, 5.1, 0.72) },
  { name: "Lot C · primed", counts: mk(192, 3.4, 2.4) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Germination</CardTitle>
        <CardDescription>T50 and spread solved from the counts</CardDescription>
      </CardHeader>
      <CardContent>
        <GerminationCurve lots={lots} sown={200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The same total over a week is two crops <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          200 seeds per lot
        </div>
      </CardFooter>
    </Card>
  )
}
