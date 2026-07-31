import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OptionPayoff } from "@/components/charts/lib/finance3"
const legs = [
  { kind: "stock" as const, side: "long" as const, strike: 100, premium: 0, qty: 1 },
  { kind: "put" as const, side: "long" as const, strike: 92, premium: 3.1, qty: 1 },
  { kind: "call" as const, side: "short" as const, strike: 112, premium: 2.4, qty: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Option payoff</CardTitle>
        <CardDescription>A collar against the underlying</CardDescription>
      </CardHeader>
      <CardContent>
        <OptionPayoff legs={legs} spot={100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Break-even is solved, not stated <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Expiry profile
        </div>
      </CardFooter>
    </Card>
  )
}
