import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CallStack } from "@/components/charts/lib/emergency"
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const shape = [0.42, 0.34, 0.29, 0.26, 0.28, 0.36, 0.58, 0.78, 0.92, 0.96, 1, 0.98,
  0.96, 0.94, 0.95, 0.98, 1.02, 1.06, 1.04, 0.94, 0.86, 0.78, 0.66, 0.52]
const calls = shape.map((v) => Math.round(v * 21))
const crews = hours.map((_, i) => (i >= 7 && i < 19 ? 26 : i >= 19 && i < 23 ? 22 : 14))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demand against crews</CardTitle>
        <CardDescription>Calls converted to crew-hours</CardDescription>
      </CardHeader>
      <CardContent>
        <CallStack hours={hours} calls={calls} crews={crews} meanJobHours={1.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A shift-pattern problem, not a headcount one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One day
        </div>
      </CardFooter>
    </Card>
  )
}
