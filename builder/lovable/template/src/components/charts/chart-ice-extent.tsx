import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IceExtent } from "@/components/charts/lib/climate"
const years = Array.from({ length: 14 }, (_, i) => {
  const yr = 2011 + i
  const decline = i * 0.09
  return {
    year: yr,
    monthly: Array.from({ length: 12 }, (_, m) =>
      Number((10.2 - decline + 4.2 * Math.cos(((m - 2) / 12) * Math.PI * 2) - (m > 6 && m < 10 ? decline * 1.6 : 0)).toFixed(2)),
    ),
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal ice</CardTitle>
        <CardDescription>Each year, with the minima</CardDescription>
      </CardHeader>
      <CardContent>
        <IceExtent years={years} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The minimum moves on its own <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Million km²
        </div>
      </CardFooter>
    </Card>
  )
}
