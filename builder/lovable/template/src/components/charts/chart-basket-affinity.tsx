import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BasketAffinity } from "@/components/charts/lib/retail2"
const items = [
  { sku: "Bread", baskets: 41200 }, { sku: "Milk", baskets: 48800 },
  { sku: "Nappies", baskets: 5100 }, { sku: "Beer", baskets: 11400 },
  { sku: "Pasta", baskets: 18900 }, { sku: "Passata", baskets: 7300 },
  { sku: "Tea", baskets: 22600 },
]
const pairs = [
  { a: "Pasta", b: "Passata", baskets: 4900 },
  { a: "Nappies", b: "Beer", baskets: 720 },
  { a: "Bread", b: "Milk", baskets: 19800 },
  { a: "Tea", b: "Milk", baskets: 12100 },
  { a: "Bread", b: "Beer", baskets: 2600 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bought together</CardTitle>
        <CardDescription>Lift, not raw co-occurrence</CardDescription>
      </CardHeader>
      <CardContent>
        <BasketAffinity items={items} pairs={pairs} baskets={92000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Popular pairs are not the same as related ones <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
