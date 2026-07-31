import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CarbonStock } from "@/components/charts/lib/forestry"
const years = Array.from({ length: 30 }, (_, i) => {
  const year = 1995 + i * 2
  const felled = i >= 20
  const age = felled ? (i - 20) * 2 : year - 1970
  const ag = Math.min(210, 3.6 * age)
  return {
    year,
    aboveGround: ag,
    belowGround: ag * 0.24,
    deadwood: felled && i < 24 ? 18 : ag * 0.06,
    soil: 88 + Math.min(24, age * 0.3),
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carbon stock</CardTitle>
        <CardDescription>Each pool separately, so a harvest is visible</CardDescription>
      </CardHeader>
      <CardContent>
        <CarbonStock years={years} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The soil pool barely moves at felling <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          tC per hectare
        </div>
      </CardFooter>
    </Card>
  )
}
