import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SomaticCell } from "@/components/charts/lib/herd"
let s = 53
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const cows = Array.from({ length: 20 }, (_, i) => ({
  id: `C${2900 + i * 11}`,
  sccThousand: Math.round(40 + Math.pow(rnd(), 3.4) * 2200),
  litres: Math.round(14 + rnd() * 26),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk tank cell count</CardTitle>
        <CardDescription>The tank is a yield-weighted mean</CardDescription>
      </CardHeader>
      <CardContent>
        <SomaticCell cows={cows} bulkLimit={200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A high-count cow giving little barely moves it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twenty cows
        </div>
      </CardFooter>
    </Card>
  )
}
