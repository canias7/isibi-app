import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RipenessCurve } from "@/components/charts/lib/winery"
const samples = [
  { date: "18 Aug", brix: 19.4, ph: 3.24, taGL: 8.9 },
  { date: "25 Aug", brix: 21.1, ph: 3.31, taGL: 7.8 },
  { date: "1 Sep", brix: 22.6, ph: 3.38, taGL: 6.9 },
  { date: "8 Sep", brix: 23.8, ph: 3.44, taGL: 6.2 },
  { date: "15 Sep", brix: 24.6, ph: 3.51, taGL: 5.8 },
  { date: "22 Sep", brix: 25.2, ph: 3.58, taGL: 5.4 },
  { date: "29 Sep", brix: 25.9, ph: 3.66, taGL: 5.0 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ripeness</CardTitle>
        <CardDescription>Three measures, one pick window</CardDescription>
      </CardHeader>
      <CardContent>
        <RipenessCurve samples={samples} targetBrix={[23.5, 25.5]} maxPh={3.6} minTa={5.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sugar is sampled daily and decides least <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cabernet, block 4
        </div>
      </CardFooter>
    </Card>
  )
}
