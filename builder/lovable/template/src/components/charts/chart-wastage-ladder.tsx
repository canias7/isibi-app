import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WastageLadder } from "@/components/charts/lib/bakery"
const lines = [
  { name: "Sourdough", baked: 420, sold: 388, costEach: 0.94, priceEach: 4.5 },
  { name: "Croissant", baked: 660, sold: 512, costEach: 0.41, priceEach: 2.8 },
  { name: "Tin loaf", baked: 380, sold: 361, costEach: 0.52, priceEach: 3.2 },
  { name: "Almond pastry", baked: 240, sold: 141, costEach: 0.88, priceEach: 3.6 },
  { name: "Focaccia", baked: 180, sold: 132, costEach: 0.61, priceEach: 3.9 },
  { name: "Baguette", baked: 300, sold: 284, costEach: 0.29, priceEach: 2.4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wastage</CardTitle>
        <CardDescription>Unsold, priced at cost</CardDescription>
      </CardHeader>
      <CardContent>
        <WastageLadder lines={lines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The answer to a bad line is to bake fewer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last week
        </div>
      </CardFooter>
    </Card>
  )
}
