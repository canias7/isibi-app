import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TreeRing } from "@/components/charts/lib/forestry"
let s = 23
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const rings = Array.from({ length: 100 }, (_, i) => {
  const year = 1890 + i
  const age = 3.4 * Math.exp(-i / 46) + 0.55
  const drought = [1921, 1934, 1976, 1959].includes(year) ? 0.42 : 1
  const good = [1903, 1946, 1968].includes(year) ? 1.55 : 1
  return { year, widthMm: age * drought * good * (0.85 + rnd() * 0.3) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ring widths</CardTitle>
        <CardDescription>Detrended against the tree's own age curve</CardDescription>
      </CardHeader>
      <CardContent>
        <TreeRing rings={rings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A raw series narrows whatever the climate did <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1890–1989
        </div>
      </CardFooter>
    </Card>
  )
}
