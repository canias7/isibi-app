import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PortionScale } from "@/components/charts/lib/nutrition"
const ingredients = [
  { name: "Plain flour", quantity: 250, unit: "g" },
  { name: "Eggs", quantity: 3, unit: "", indivisible: true },
  { name: "Milk", quantity: 400, unit: "ml" },
  { name: "Butter", quantity: 60, unit: "g" },
  { name: "Vanilla pods", quantity: 1, unit: "", indivisible: true },
  { name: "Bay leaves", quantity: 2, unit: "", indivisible: true },
  { name: "Sugar", quantity: 90, unit: "g" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipe scaling</CardTitle>
        <CardDescription>Where an indivisible ingredient stops scaling</CardDescription>
      </CardHeader>
      <CardContent>
        <PortionScale ingredients={ingredients} baseServings={4} targetServings={7} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          0.37 of an egg is where it breaks <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          4 → 7 servings
        </div>
      </CardFooter>
    </Card>
  )
}
