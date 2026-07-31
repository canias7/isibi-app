import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SolubilityCurve } from "@/components/charts/lib/chemlab"
const mk = (name: string, a: number, b: number) => ({
  name,
  points: Array.from({ length: 21 }, (_, i) => {
    const tempC = i * 5
    return { tempC, gPer100: Number((a + b * tempC + (b > 1 ? 0.006 * tempC * tempC : 0)).toFixed(1)) }
  }),
})
const salts = [mk("Potassium nitrate", 13, 1.9), mk("Sodium chloride", 35.6, 0.024), mk("Copper sulfate", 14, 0.42)]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Solubility with temperature</CardTitle>
        <CardDescription>And what crystallises on cooling</CardDescription>
      </CardHeader>
      <CardContent>
        <SolubilityCurve salts={salts} coolFrom={80} coolTo={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The yield is the vertical gap <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Per 100 g water
        </div>
      </CardFooter>
    </Card>
  )
}
