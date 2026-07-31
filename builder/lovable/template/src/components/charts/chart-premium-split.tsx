import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PremiumSplit } from "@/components/charts/lib/auction"
const tiers = [
  { upTo: 20000, rate: 0.26 },
  { upTo: 200000, rate: 0.2 },
  { upTo: null, rate: 0.145 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The two halves</CardTitle>
        <CardDescription>Where the buyer and the seller meet</CardDescription>
      </CardHeader>
      <CardContent>
        <PremiumSplit tiers={tiers} sellerCommission={0.12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Neither side ever sees the other's number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Tiered premium
        </div>
      </CardFooter>
    </Card>
  )
}
