import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EqCurve } from "@/components/charts/lib/music2"
const bands = [
  { hz: 60, gainDb: -4.5, q: 0.7 },
  { hz: 180, gainDb: -3.5, q: 1.1 },
  { hz: 900, gainDb: 1.8, q: 0.8 },
  { hz: 3000, gainDb: 4.2, q: 2.4 },
  { hz: 3400, gainDb: -3.1, q: 3.1 },
  { hz: 9000, gainDb: 2.6, q: 0.7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>EQ curve</CardTitle>
        <CardDescription>Filter bands summed into one response</CardDescription>
      </CardHeader>
      <CardContent>
        <EqCurve bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two bands are fighting at 3 kHz <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Mix bus
        </div>
      </CardFooter>
    </Card>
  )
}
