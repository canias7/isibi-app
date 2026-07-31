import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NutrientDensity } from "@/components/charts/lib/nutrition"
const nutrients = [
  { key: "iron", label: "Iron", reference: 14, unit: "mg" },
  { key: "calcium", label: "Calcium", reference: 800, unit: "mg" },
  { key: "folate", label: "Folate", reference: 200, unit: "µg" },
  { key: "vitC", label: "Vitamin C", reference: 80, unit: "mg" },
  { key: "potassium", label: "Potassium", reference: 2000, unit: "mg" },
]
const foods = [
  { name: "Spinach, raw", kcalPer100g: 23, per100g: { iron: 2.7, calcium: 99, folate: 194, vitC: 28, potassium: 558 } },
  { name: "Beef mince", kcalPer100g: 250, per100g: { iron: 2.6, calcium: 18, folate: 8, vitC: 0, potassium: 318 } },
  { name: "Lentils, cooked", kcalPer100g: 116, per100g: { iron: 3.3, calcium: 19, folate: 181, vitC: 1.5, potassium: 369 } },
  { name: "Almonds", kcalPer100g: 579, per100g: { iron: 3.7, calcium: 269, folate: 44, vitC: 0, potassium: 733 } },
  { name: "Broccoli", kcalPer100g: 34, per100g: { iron: 0.7, calcium: 47, folate: 63, vitC: 89, potassium: 316 } },
  { name: "White bread", kcalPer100g: 265, per100g: { iron: 3.6, calcium: 260, folate: 85, vitC: 0, potassium: 115 } },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrient density</CardTitle>
        <CardDescription>Per hundred calories, not per hundred grams</CardDescription>
      </CardHeader>
      <CardContent>
        <NutrientDensity foods={foods} nutrients={nutrients} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Which comparison depends on whether you want the energy <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six foods
        </div>
      </CardFooter>
    </Card>
  )
}
