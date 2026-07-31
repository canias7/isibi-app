import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BakersPercent } from "@/components/charts/lib/bakery"
const formulas = [
  { name: "Country sourdough", ingredients: [
    { name: "Strong white", grams: 850, isFlour: true },
    { name: "Wholemeal", grams: 150, isFlour: true },
    { name: "Water", grams: 780, isWater: true },
    { name: "Levain", grams: 200 },
    { name: "Salt", grams: 20 }] },
  { name: "Tin loaf", ingredients: [
    { name: "Strong white", grams: 1000, isFlour: true },
    { name: "Water", grams: 640, isWater: true },
    { name: "Butter", grams: 30 },
    { name: "Yeast", grams: 12 },
    { name: "Salt", grams: 18 }] },
  { name: "Ciabatta", ingredients: [
    { name: "Type 0", grams: 1000, isFlour: true },
    { name: "Water", grams: 840, isWater: true },
    { name: "Biga", grams: 300 },
    { name: "Olive oil", grams: 25 },
    { name: "Salt", grams: 22 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Baker's percentage</CardTitle>
        <CardDescription>Grams converted to a formula</CardDescription>
      </CardHeader>
      <CardContent>
        <BakersPercent formulas={formulas} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Twenty points of hydration is how it handles <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three doughs
        </div>
      </CardFooter>
    </Card>
  )
}
