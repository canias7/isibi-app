import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BeveridgeCurve } from "@/components/charts/lib/econ"
const points = Array.from({ length: 20 }, (_, i) => {
  const u = 3.6 + Math.sin(i / 3.1) * 1.6 + i * 0.06
  return { period: `Q${(i % 4) + 1} '${20 + Math.floor(i / 4)}`, unemployment: Number(u.toFixed(2)), vacancies: Number((5.4 - u * 0.7 + i * 0.08).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vacancies and unemployment</CardTitle>
        <CardDescription>How well the market matches</CardDescription>
      </CardHeader>
      <CardContent>
        <BeveridgeCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Outward means worse matching <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Quarterly
        </div>
      </CardFooter>
    </Card>
  )
}
