import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CostPerNutrient } from "@/components/charts/lib/nutrition"
const foods = [
  { name: "Lentils, dry", pricePerKg: 2.4, amountPer100g: 7.5, kcalPer100g: 353 },
  { name: "Liver", pricePerKg: 6.8, amountPer100g: 6.2, kcalPer100g: 175 },
  { name: "Beef mince", pricePerKg: 8.9, amountPer100g: 2.6, kcalPer100g: 250 },
  { name: "Fortified cereal", pricePerKg: 4.1, amountPer100g: 12, kcalPer100g: 379 },
  { name: "Spinach", pricePerKg: 5.6, amountPer100g: 2.7, kcalPer100g: 23 },
  { name: "Tofu", pricePerKg: 4.4, amountPer100g: 2.7, kcalPer100g: 76 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost per nutrient</CardTitle>
        <CardDescription>A day's worth, at the portion it implies</CardDescription>
      </CardHeader>
      <CardContent>
        <CostPerNutrient foods={foods} nutrient="iron" unit="mg" reference={14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cheap per gram is not cheap per plate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Iron, 14 mg/day
        </div>
      </CardFooter>
    </Card>
  )
}
