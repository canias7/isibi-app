import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GlycemicLoad } from "@/components/charts/lib/nutrition"
const foods = [
  { name: "Watermelon", glycemicIndex: 76, portionG: 200, carbPer100g: 7.6, fibrePer100g: 0.4 },
  { name: "White rice", glycemicIndex: 73, portionG: 180, carbPer100g: 28, fibrePer100g: 0.4 },
  { name: "Wholemeal bread", glycemicIndex: 74, portionG: 70, carbPer100g: 43, fibrePer100g: 7 },
  { name: "Baked potato", glycemicIndex: 85, portionG: 220, carbPer100g: 21, fibrePer100g: 2.2 },
  { name: "Lentils", glycemicIndex: 32, portionG: 200, carbPer100g: 20, fibrePer100g: 7.9 },
  { name: "Apple", glycemicIndex: 36, portionG: 180, carbPer100g: 14, fibrePer100g: 2.4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Glycaemic load</CardTitle>
        <CardDescription>Index times the carbohydrate actually eaten</CardDescription>
      </CardHeader>
      <CardContent>
        <GlycemicLoad foods={foods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A high index in a small portion is not the same <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One day
        </div>
      </CardFooter>
    </Card>
  )
}
