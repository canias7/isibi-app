import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MacroSplit } from "@/components/charts/lib/nutrition"
const meals = [
  { name: "Breakfast", proteinG: 24, carbG: 62, fatG: 14, fibreG: 9 },
  { name: "Lunch", proteinG: 38, carbG: 74, fatG: 26, fibreG: 11 },
  { name: "Snack", proteinG: 9, carbG: 31, fatG: 12, fibreG: 4 },
  { name: "Dinner", proteinG: 46, carbG: 88, fatG: 34, fibreG: 13 },
  { name: "Drinks", proteinG: 0, carbG: 8, fatG: 0, alcoholG: 28 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Macronutrient split</CardTitle>
        <CardDescription>Energy computed from the grams</CardDescription>
      </CardHeader>
      <CardContent>
        <MacroSplit meals={meals} targetPercent={{ protein: 25, carbohydrate: 45, fat: 30 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Alcohol belongs in the denominator <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One day
        </div>
      </CardFooter>
    </Card>
  )
}
