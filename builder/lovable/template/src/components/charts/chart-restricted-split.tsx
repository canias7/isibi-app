import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RestrictedSplit } from "@/components/charts/lib/fundraising"
const sources = [
  { name: "Statutory grant", amount: 1240000, restricted: true, recoveryRate: 0.08 },
  { name: "Trust: capital appeal", amount: 680000, restricted: true, recoveryRate: 0 },
  { name: "Lottery, delivery", amount: 520000, restricted: true, recoveryRate: 0.15 },
  { name: "Regular giving", amount: 486000, restricted: false },
  { name: "Legacies", amount: 312000, restricted: false },
  { name: "Corporate partnership", amount: 240000, restricted: true, recoveryRate: 0.2 },
  { name: "Community fundraising", amount: 178000, restricted: false },
  { name: "Trading", amount: 96000, restricted: false },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restricted income</CardTitle>
        <CardDescription>What can actually pay for the charity</CardDescription>
      </CardHeader>
      <CardContent>
        <RestrictedSplit sources={sources} coreCosts={1320000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A record fundraising year can still not pay the rent <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Against core costs
        </div>
      </CardFooter>
    </Card>
  )
}
