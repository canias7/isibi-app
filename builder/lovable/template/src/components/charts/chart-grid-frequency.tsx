import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GridFrequency } from "@/components/charts/lib/power"
let s = 11
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5)
const samples = Array.from({ length: 240 }, (_, i) => ({
  t: `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
  hz: 50 + Math.sin(i / 19) * 0.06 + rnd() * 0.07 + (i > 150 && i < 162 ? -0.19 : 0),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mains frequency</CardTitle>
        <CardDescription>Deviation from nominal</CardDescription>
      </CardHeader>
      <CardContent>
        <GridFrequency samples={samples} nominal={50} band={0.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The whole story is tens of millihertz <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One hour
        </div>
      </CardFooter>
    </Card>
  )
}
