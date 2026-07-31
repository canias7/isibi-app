import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FlowDurationCurve } from "@/components/charts/lib/water"
let s = 17
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const flows = Array.from({ length: 3650 }, (_, i) => {
  const season = 1 + Math.cos((i / 365) * Math.PI * 2) * 0.6
  const storm = r() > 0.982 ? 14 * r() : 0
  return Number((0.9 * season * (0.5 + r()) + storm).toFixed(3))
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How often the river runs</CardTitle>
        <CardDescription>Flow against exceedance</CardDescription>
      </CardHeader>
      <CardContent>
        <FlowDurationCurve flows={flows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Q95 is what a licence is written against <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Ten years of daily means
        </div>
      </CardFooter>
    </Card>
  )
}
