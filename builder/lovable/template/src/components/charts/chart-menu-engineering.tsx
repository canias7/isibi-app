import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MenuEngineering } from "@/components/charts/lib/restaurant"
const dishes = [
  { name: "Ribeye", sold: 412, price: 38, foodCost: 16.4 },
  { name: "Sea bass", sold: 288, price: 31, foodCost: 11.2 },
  { name: "Gnocchi", sold: 511, price: 21, foodCost: 4.1 },
  { name: "Duck breast", sold: 176, price: 34, foodCost: 13.8 },
  { name: "Burger", sold: 690, price: 19, foodCost: 6.9 },
  { name: "Lamb shank", sold: 96, price: 33, foodCost: 15.6 },
  { name: "Risotto", sold: 204, price: 23, foodCost: 4.6 },
  { name: "Sole meunière", sold: 61, price: 41, foodCost: 22.4 },
  { name: "Caesar", sold: 470, price: 14, foodCost: 3.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu engineering</CardTitle>
        <CardDescription>Popularity against contribution margin</CardDescription>
      </CardHeader>
      <CardContent>
        <MenuEngineering dishes={dishes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing is a dog — but two puzzles are <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Dinner menu, 90 days
        </div>
      </CardFooter>
    </Card>
  )
}
