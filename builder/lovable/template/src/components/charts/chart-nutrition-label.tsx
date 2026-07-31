import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NutritionLabel } from "@/components/charts/lib/craft"
const per100g = {
  energyKcal: 379, fat: 6.6, saturates: 1.2, carbs: 67,
  sugars: 22, fibre: 7.1, protein: 8.4, salt: 0.61,
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Back of the packet</CardTitle>
        <CardDescription>Per 100g and per portion</CardDescription>
      </CardHeader>
      <CardContent>
        <NutritionLabel per100g={per100g} portionGrams={55} servings={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          %RI computed against reference intakes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One serving 55g
        </div>
      </CardFooter>
    </Card>
  )
}
