import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FilingJurisdictions } from "@/components/charts/lib/patents"
const jurisdictions = [
  { name: "United States", filingCost: 14_000, annualRenewal: 1_900, renewalGrowth: 0.05, marketShare: 0.38 },
  { name: "EPO + validation", filingCost: 22_000, annualRenewal: 4_200, renewalGrowth: 0.09, marketShare: 0.24 },
  { name: "China", filingCost: 6_500, annualRenewal: 1_100, renewalGrowth: 0.11, marketShare: 0.14 },
  { name: "Japan", filingCost: 9_800, annualRenewal: 1_600, renewalGrowth: 0.1, marketShare: 0.09 },
  { name: "India", filingCost: 4_200, annualRenewal: 700, renewalGrowth: 0.08, marketShare: 0.08 },
  { name: "Brazil", filingCost: 5_600, annualRenewal: 900, renewalGrowth: 0.07, marketShare: 0.07 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filing programme</CardTitle>
        <CardDescription>Renewals compounded over the patent life</CardDescription>
      </CardHeader>
      <CardContent>
        <FilingJurisdictions jurisdictions={jurisdictions} years={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The headline filing cost is a third of it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twenty years
        </div>
      </CardFooter>
    </Card>
  )
}
