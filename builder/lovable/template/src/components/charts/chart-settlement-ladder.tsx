import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SettlementLadder } from "@/components/charts/lib/legal"
const offers = [
  { date: "Feb", amount: 90000, from: "defendant" as const },
  { date: "Mar", amount: 480000, from: "claimant" as const },
  { date: "May", amount: 165000, from: "defendant" as const },
  { date: "Jul", amount: 390000, from: "claimant" as const },
  { date: "Sep", amount: 310000, from: "defendant" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offers against expected value</CardTitle>
        <CardDescription>Every offer placed on the risk-adjusted line</CardDescription>
      </CardHeader>
      <CardContent>
        <SettlementLadder
          offers={offers}
          probabilityOfWin={0.62}
          likelyAward={610000}
          ownCosts={185000}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The last offer beats running the trial <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Costs included
        </div>
      </CardFooter>
    </Card>
  )
}
