import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KilnLoad } from "@/components/charts/lib/ceramics"
const shelves = [
  { name: "Shelf 1", pots: [{ name: "Vases", heightMm: 265, count: 4 }, { name: "Beakers", heightMm: 95, count: 6 }] },
  { name: "Shelf 2", pots: [{ name: "Mugs", heightMm: 105, count: 14 }] },
  { name: "Shelf 3", pots: [{ name: "Bowls", heightMm: 78, count: 9 }, { name: "Jug", heightMm: 240, count: 1 }] },
  { name: "Shelf 4", pots: [{ name: "Plates", heightMm: 32, count: 18 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiln pack</CardTitle>
        <CardDescription>A shelf is set to its tallest pot</CardDescription>
      </CardHeader>
      <CardContent>
        <KilnLoad shelves={shelves} shelfHeightMm={280} firingCost={38} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sorting by height is worth a firing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cone 6 glaze, one load
        </div>
      </CardFooter>
    </Card>
  )
}
