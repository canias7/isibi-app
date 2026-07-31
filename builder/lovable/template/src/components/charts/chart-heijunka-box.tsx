import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeijunkaBox } from "@/components/charts/lib/mfg"
const slots = ["08:00", "10:00", "12:00", "14:00", "16:00"]
const products = ["Frame", "Panel", "Hinge"]
const grid = [
  [2, 2, 2, 2, 2],
  [1, 2, 1, 2, 1],
  [3, 2, 3, 1, 3],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Levelling box</CardTitle>
        <CardDescription>Work spread evenly across the slots</CardDescription>
      </CardHeader>
      <CardContent>
        <HeijunkaBox slots={slots} products={products} grid={grid} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Peak against trough is what levelling closes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One card is one unit
        </div>
      </CardFooter>
    </Card>
  )
}
