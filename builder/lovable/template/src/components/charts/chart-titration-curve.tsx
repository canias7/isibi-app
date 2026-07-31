import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TitrationCurve } from "@/components/charts/lib/chem"
const curve = Array.from({ length: 61 }, (_, i) => {
  const ml = i * 0.833
  const f = (ml - 25) / 1.15
  return { ml: Number(ml.toFixed(1)), ph: Number((1.2 + 11.4 / (1 + Math.exp(-f))).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Titration</CardTitle>
        <CardDescription>pH as base is added</CardDescription>
      </CardHeader>
      <CardContent>
        <TitrationCurve points={curve} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Equivalence taken from the steepest point <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Strong acid, strong base
        </div>
      </CardFooter>
    </Card>
  )
}
