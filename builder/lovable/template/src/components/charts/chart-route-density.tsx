import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RouteDensity } from "@/components/charts/lib/logistics"
const grid = Array.from({ length: 14 }, (_, r) =>
  Array.from({ length: 16 }, (_, c) => {
    const town = 26 * Math.exp(-(((c - 5) ** 2 + (r - 6) ** 2) / 9))
    const suburb = 12 * Math.exp(-(((c - 11) ** 2 + (r - 4) ** 2) / 14))
    return Math.round(town + suburb + 1)
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drops per square</CardTitle>
        <CardDescription>Where the round pays</CardDescription>
      </CardHeader>
      <CardContent>
        <RouteDensity grid={grid} minViable={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The sparse squares lose money <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One depot area
        </div>
      </CardFooter>
    </Card>
  )
}
