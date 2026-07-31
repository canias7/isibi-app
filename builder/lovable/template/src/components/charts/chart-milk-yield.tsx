import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MilkYield } from "@/components/charts/lib/herd"
let s = 13
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const records = Array.from({ length: 10 }, (_, i) => {
  const dim = 15 + i * 30
  return { dim, litres: 42 * Math.pow(dim, 0.22) * Math.exp(-0.0042 * dim) + (rnd() - 0.5) * 1.4 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lactation curve</CardTitle>
        <CardDescription>Peak, persistency and the 305-day total</CardDescription>
      </CardHeader>
      <CardContent>
        <MilkYield records={records} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A shallow decline beats a high peak <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Test-day records
        </div>
      </CardFooter>
    </Card>
  )
}
