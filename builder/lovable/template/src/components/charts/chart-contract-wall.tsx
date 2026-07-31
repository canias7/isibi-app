import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContractWall } from "@/components/charts/lib/gym"
const months = [
  { label: "Aug", reachingTerm: 96 },
  { label: "Sep", reachingTerm: 121 },
  { label: "Oct", reachingTerm: 108 },
  { label: "Nov", reachingTerm: 94 },
  { label: "Dec", reachingTerm: 74 },
  { label: "Jan", reachingTerm: 118 },
  { label: "Feb", reachingTerm: 412 },
  { label: "Mar", reachingTerm: 186 },
  { label: "Apr", reachingTerm: 141 },
  { label: "May", reachingTerm: 112 },
  { label: "Jun", reachingTerm: 98 },
  { label: "Jul", reachingTerm: 104 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Out of contract</CardTitle>
        <CardDescription>The month a commitment can be acted on</CardDescription>
      </CardHeader>
      <CardContent>
        <ContractWall months={months} monthlyFee={34} historicRenewalRate={0.62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Retention belongs a month before the wall <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Next twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
