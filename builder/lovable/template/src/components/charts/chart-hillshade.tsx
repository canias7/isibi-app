import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Hillshade } from "@/components/charts/lib/carto"
const terrain = Array.from({ length: 44 }, (_, r) =>
  Array.from({ length: 44 }, (_, c) => {
    const x = (c - 22) / 9, y = (r - 22) / 9
    return (
      60 * Math.exp(-(x * x + y * y) / 1.3) +
      34 * Math.exp(-((x - 1.6) ** 2 + (y + 1.2) ** 2) / 0.5) +
      6 * Math.sin(x * 3) * Math.cos(y * 2.4)
    )
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relief</CardTitle>
        <CardDescription>Shaded from the same height field</CardDescription>
      </CardHeader>
      <CardContent>
        <Hillshade field={terrain} exaggeration={3} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Lit from the north-west <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Vertical exaggeration ×3
        </div>
      </CardFooter>
    </Card>
  )
}
