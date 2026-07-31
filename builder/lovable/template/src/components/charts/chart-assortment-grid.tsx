import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AssortmentGrid } from "@/components/charts/lib/retail2"
const categories = ["Outerwear", "Knitwear", "Shirts", "Trousers"]
const tiers = ["Value", "Core", "Premium"]
const cells = [
  [{ lines: 6, revenue: 82000 }, { lines: 11, revenue: 240000 }, { lines: 4, revenue: 196000 }],
  [{ lines: 8, revenue: 61000 }, { lines: 14, revenue: 188000 }, { lines: 0, revenue: 0 }],
  [{ lines: 5, revenue: 44000 }, { lines: 17, revenue: 205000 }, { lines: 6, revenue: 121000 }],
  [{ lines: 0, revenue: 0 }, { lines: 12, revenue: 174000 }, { lines: 3, revenue: 68000 }],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The range</CardTitle>
        <CardDescription>Category against price tier</CardDescription>
      </CardHeader>
      <CardContent>
        <AssortmentGrid categories={categories} tiers={tiers} cells={cells} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dashed squares are gaps in the range <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Autumn
        </div>
      </CardFooter>
    </Card>
  )
}
