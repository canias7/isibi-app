import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VintageIndex } from "@/components/charts/lib/winery"
let s = 733
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const vintages = Array.from({ length: 24 }, (_, i) => {
  const gdd = 1280 + Math.round(rnd() * 420)
  const rain = Math.round(Math.pow(rnd(), 1.8) * 140)
  const score = Math.round((78 + (gdd - 1280) / 34 - rain / 11 + rnd() * 4) * 10) / 10
  return { year: 2001 + i, growingDegreeDays: gdd, harvestRainMm: rain, score }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vintage conditions</CardTitle>
        <CardDescription>Two numbers behind a vintage chart</CardDescription>
      </CardHeader>
      <CardContent>
        <VintageIndex vintages={vintages} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Correlations from the record, not from memory <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twenty-four years
        </div>
      </CardFooter>
    </Card>
  )
}
