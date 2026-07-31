import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InflationBasket } from "@/components/charts/lib/econ"
const items = [
  { name: "Housing & energy", weight: 0.29, rate: 0.081 },
  { name: "Food", weight: 0.11, rate: 0.124 },
  { name: "Transport", weight: 0.15, rate: 0.038 },
  { name: "Recreation", weight: 0.12, rate: 0.021 },
  { name: "Restaurants", weight: 0.11, rate: 0.056 },
  { name: "Clothing", weight: 0.06, rate: -0.014 },
  { name: "Communication", weight: 0.03, rate: -0.032 },
  { name: "Other", weight: 0.13, rate: 0.019 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What drove the headline</CardTitle>
        <CardDescription>Contribution, not rate</CardDescription>
      </CardHeader>
      <CardContent>
        <InflationBasket items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Contributions sum to the headline <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
