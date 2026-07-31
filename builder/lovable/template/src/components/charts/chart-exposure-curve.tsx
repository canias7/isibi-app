import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ExposureCurve } from "@/components/charts/lib/insure"
const points = Array.from({ length: 41 }, (_, i) => {
  const d = i / 40
  return { d, g: Number((1 - Math.pow(1 - d, 2.6)).toFixed(4)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where losses fall</CardTitle>
        <CardDescription>Share of loss below each share of the sum insured</CardDescription>
      </CardHeader>
      <CardContent>
        <ExposureCurve points={points} layer={{ from: 0.2, to: 0.5 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A layer's share is the gap between its points <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Property
        </div>
      </CardFooter>
    </Card>
  )
}
