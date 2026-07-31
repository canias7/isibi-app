import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NutrientSolution } from "@/components/charts/lib/horticulture"
const salts = [
  { name: "Calcium nitrate", grams: 940, analysis: { N: 15.5, Ca: 19 } },
  { name: "Potassium nitrate", grams: 580, analysis: { N: 13, K: 38 } },
  { name: "Monopotassium phosphate", grams: 190, analysis: { P: 22.7, K: 28.7 } },
  { name: "Magnesium sulphate", grams: 490, analysis: { Mg: 9.8, S: 13 } },
  { name: "Potassium sulphate", grams: 120, analysis: { K: 44.9, S: 18.4 } },
]
const target = { N: 165, P: 45, K: 280, Ca: 180, Mg: 48, S: 90 }

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feed recipe</CardTitle>
        <CardDescription>Delivered ppm computed from the salt weights</CardDescription>
      </CardHeader>
      <CardContent>
        <NutrientSolution salts={salts} litres={1000} target={target} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The ratios are what the plant responds to <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1000 L tank
        </div>
      </CardFooter>
    </Card>
  )
}
