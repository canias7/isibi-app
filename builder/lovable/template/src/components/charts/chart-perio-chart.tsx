import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PerioChart } from "@/components/charts/lib/dentistry"
let s = 616
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const teeth = ["18", "17", "16", "15", "14", "13", "12", "11"].map((id, ti) => {
  const base = ti < 3 ? 3.4 : 2.3
  const depths = Array.from({ length: 6 }, () => Math.max(1, Math.round(base + rnd() * 3.2)))
  return { id, depths, bleeding: depths.map((d) => d >= 4 && rnd() < 0.72) }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pocket chart</CardTitle>
        <CardDescription>Depth and bleeding, two facts per site</CardDescription>
      </CardHeader>
      <CardContent>
        <PerioChart teeth={teeth} threshold={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A deep pocket that does not bleed is a scar <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Upper right quadrant
        </div>
      </CardFooter>
    </Card>
  )
}
