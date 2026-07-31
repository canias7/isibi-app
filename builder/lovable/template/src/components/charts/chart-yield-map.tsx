import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { YieldMap } from "@/components/charts/lib/agri"
const grid = Array.from({ length: 22 }, (_, r) =>
  Array.from({ length: 26 }, (_, c) => {
    const wet = 3.2 * Math.exp(-(((c - 5) ** 2 + (r - 15) ** 2) / 22))
    const headland = r < 2 || r > 19 || c < 2 || c > 23 ? 1.6 : 0
    return Number((9.4 - wet - headland + Math.sin(c / 3) * 0.3).toFixed(2))
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yield across the field</CardTitle>
        <CardDescription>Where it underperforms</CardDescription>
      </CardHeader>
      <CardContent>
        <YieldMap grid={grid} target={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Outlined squares are below target <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Combine data
        </div>
      </CardFooter>
    </Card>
  )
}
