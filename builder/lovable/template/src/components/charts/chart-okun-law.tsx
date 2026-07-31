import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OkunLaw } from "@/components/charts/lib/econ"
let s = 5
const j = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 0.55
const points = Array.from({ length: 26 }, (_, i) => {
  const g = -1.4 + i * 0.24 + j() * 2
  return { year: 1998 + i, gdpGrowth: Number(g.toFixed(2)), unemploymentChange: Number((0.92 - g * 0.46 + j()).toFixed(2)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth and unemployment</CardTitle>
        <CardDescription>The fitted relationship</CardDescription>
      </CardHeader>
      <CardContent>
        <OkunLaw points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Slope computed by least squares <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Annual
        </div>
      </CardFooter>
    </Card>
  )
}
