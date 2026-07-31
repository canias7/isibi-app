import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BidderDepth } from "@/components/charts/lib/auction"
const lots = [
  { name: "Pair famille rose vases", hammer: 8200, lowEstimate: 3000, biddersAtSteps: [11, 9, 7, 5, 4, 3, 2, 2] },
  { name: "Rolex Datejust, 1978", hammer: 4900, lowEstimate: 2500, biddersAtSteps: [14, 12, 10, 8, 7, 6, 5, 4] },
  { name: "Bronze, after Barye", hammer: 1320, lowEstimate: 700, biddersAtSteps: [6, 4, 3, 2, 2] },
  { name: "Silver tea service", hammer: 1150, lowEstimate: 600, biddersAtSteps: [9, 7, 6, 5, 4] },
  { name: "18c walnut bureau", hammer: 1450, lowEstimate: 800, biddersAtSteps: [8, 6, 5, 4, 3] },
  { name: "Victorian mourning ring", hammer: 620, lowEstimate: 300, biddersAtSteps: [7, 5, 3, 2] },
  { name: "Persian rug, Kashan", hammer: 1650, lowEstimate: 1200, biddersAtSteps: [5, 4, 3, 3] },
  { name: "Oil, harbour scene", hammer: 1900, lowEstimate: 1500, biddersAtSteps: [6, 5, 4, 4] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bidder depth</CardTitle>
        <CardDescription>A market, or two people in a room</CardDescription>
      </CardHeader>
      <CardContent>
        <BidderDepth lots={lots} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A duel is not a comparable <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight lots
        </div>
      </CardFooter>
    </Card>
  )
}
