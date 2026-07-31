import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SubscriptionMix } from "@/components/charts/lib/publish"
const plans = [
  { name: "Digital basic", subscribers: 84000, monthlyPrice: 5 },
  { name: "Digital plus", subscribers: 31000, monthlyPrice: 12 },
  { name: "Print + digital", subscribers: 12500, monthlyPrice: 32 },
  { name: "Institutional", subscribers: 640, monthlyPrice: 410 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>People against money</CardTitle>
        <CardDescription>By plan</CardDescription>
      </CardHeader>
      <CardContent>
        <SubscriptionMix plans={plans} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The biggest plan is rarely the one paying <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Monthly
        </div>
      </CardFooter>
    </Card>
  )
}
