import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HarvestWindow } from "@/components/charts/lib/aquaculture"
const weeks = Array.from({ length: 12 }, (_, i) => {
  const week = 24 + i
  const biomassT = Math.round((980 + i * 34) * 10) / 10
  // the price steps up at 5 kg and then flattens
  const meanKg = 4.4 + i * 0.16
  const pricePerT = Math.round(5200 + (meanKg >= 5 ? 900 : 0) + Math.min(i, 6) * 40)
  return { week, biomassT, pricePerT, feedT: 42 + i }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>When to harvest</CardTitle>
        <CardDescription>Growth against feed and the stock lost waiting</CardDescription>
      </CardHeader>
      <CardContent>
        <HarvestWindow weeks={weeks} feedCostPerT={1640} weeklyMortality={0.004} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every week of waiting buys growth and pays for it twice <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pen 4
        </div>
      </CardFooter>
    </Card>
  )
}
