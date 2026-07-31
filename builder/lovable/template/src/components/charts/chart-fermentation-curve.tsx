import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FermentationCurve } from "@/components/charts/lib/brewing"
let s = 8
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const readings = Array.from({ length: 15 }, (_, d) => ({
  day: d,
  gravity: 1.056 - 0.044 * (1 / (1 + Math.exp(-(d - 3.4) / 1.5))) + (rnd() - 0.5) * 0.0008,
  celsius: d < 1 ? 18 : d < 7 ? 20 + Math.sin(d) * 0.6 : 22,
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fermentation</CardTitle>
        <CardDescription>Gravity and temperature through the ferment</CardDescription>
      </CardHeader>
      <CardContent>
        <FermentationCurve readings={readings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          ABV is solved from the two gravities <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Fourteen days
        </div>
      </CardFooter>
    </Card>
  )
}
