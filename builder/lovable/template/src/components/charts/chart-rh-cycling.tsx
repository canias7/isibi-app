import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RhCycling } from "@/components/charts/lib/museum"
let s = 37
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const trace = Array.from({ length: 168 }, (_, h) => {
  const daily = Math.sin((h / 24) * 2 * Math.PI - 1.2) * 6
  const doorEvent = h % 24 > 9 && h % 24 < 18 ? -3.5 : 0
  const drift = Math.sin((h / 168) * Math.PI) * 2
  return 50 + daily + doorEvent + drift + (rnd() - 0.5) * 1.6
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Humidity</CardTitle>
        <CardDescription>Amplitude and rate, not the mean</CardDescription>
      </CardHeader>
      <CardContent>
        <RhCycling trace={trace} targetRh={50} toleranceBand={5} maxRatePerHour={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The mean would pass any specification <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Gallery 4
        </div>
      </CardFooter>
    </Card>
  )
}
