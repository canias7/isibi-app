import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuotaUptake } from "@/components/charts/lib/fisheries"
const stocks = [
  { name: "Cod", quotaT: 1840, landedT: 1180 },
  { name: "Haddock", quotaT: 4200, landedT: 1560 },
  { name: "Whiting", quotaT: 960, landedT: 620 },
  { name: "Saithe", quotaT: 2100, landedT: 640 },
  { name: "Monkfish", quotaT: 780, landedT: 261 },
  { name: "Plaice", quotaT: 1500, landedT: 340 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quota uptake</CardTitle>
        <CardDescription>The pace, not the percentage</CardDescription>
      </CardHeader>
      <CardContent>
        <QuotaUptake stocks={stocks} monthsElapsed={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two stocks run out before the year does <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Month 5 of 12
        </div>
      </CardFooter>
    </Card>
  )
}
