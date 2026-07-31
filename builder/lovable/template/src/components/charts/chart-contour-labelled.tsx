import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContourMap } from "@/components/charts/lib/carto"
const field = Array.from({ length: 22 }, (_, r) =>
  Array.from({ length: 22 }, (_, c) => {
    const x = (c - 11) / 5, y = (r - 11) / 5
    return Math.round(
      120 +
        46 * Math.exp(-(x * x + y * y) / 1.6) +
        22 * Math.exp(-((x - 1.9) ** 2 + (y + 1.4) ** 2) / 0.7) -
        14 * Math.exp(-((x + 1.7) ** 2 + (y - 1.6) ** 2) / 0.9),
    )
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Site levels</CardTitle>
        <CardDescription>Contours with heights on the index lines</CardDescription>
      </CardHeader>
      <CardContent>
        <ContourMap field={field} levels={[120, 130, 140, 150, 160]} indexEvery={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Closely spaced lines are steep ground <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Metres above datum
        </div>
      </CardFooter>
    </Card>
  )
}
