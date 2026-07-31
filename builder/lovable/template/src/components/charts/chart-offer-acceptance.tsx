import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OfferAcceptance } from "@/components/charts/lib/recruiting"
const reasons = ["Pay", "Counter-offer", "Another offer", "Role", "Location"]
const teams = [
  { name: "Engineering", accepted: 24, declined: [9, 6, 7, 2, 1] },
  { name: "Data", accepted: 11, declined: [3, 1, 4, 1, 0] },
  { name: "Design", accepted: 7, declined: [4, 0, 2, 2, 1] },
  { name: "Commercial", accepted: 19, declined: [2, 3, 2, 1, 3] },
  { name: "Operations", accepted: 14, declined: [1, 1, 1, 2, 4] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offers</CardTitle>
        <CardDescription>Accepted, and what the rest went to</CardDescription>
      </CardHeader>
      <CardContent>
        <OfferAcceptance teams={teams} reasons={reasons} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rate says you are losing offers, not why <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last two quarters
        </div>
      </CardFooter>
    </Card>
  )
}
