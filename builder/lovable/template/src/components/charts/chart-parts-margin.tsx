import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PartsMargin } from "@/components/charts/lib/garage"
const bands = [
  { name: "Service items", lines: 412, cost: 18.4, listPrice: 41, discountGiven: 0.12 },
  { name: "Brakes", lines: 186, cost: 64, listPrice: 132, discountGiven: 0.18 },
  { name: "Tyres", lines: 298, cost: 71, listPrice: 96, discountGiven: 0.22 },
  { name: "Batteries", lines: 74, cost: 88, listPrice: 141, discountGiven: 0.15 },
  { name: "Trade counter, bulk", lines: 141, cost: 52, listPrice: 74, discountGiven: 0.34 },
  { name: "Exhausts", lines: 38, cost: 118, listPrice: 214, discountGiven: 0.16 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts</CardTitle>
        <CardDescription>What survived the discount</CardDescription>
      </CardHeader>
      <CardContent>
        <PartsMargin bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A percentage off the top is most of a thin margin <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
