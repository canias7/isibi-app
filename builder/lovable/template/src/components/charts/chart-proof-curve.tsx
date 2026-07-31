import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProofCurve } from "@/components/charts/lib/bakery"
const readings = [
  { minutes: 0, rise: 1 }, { minutes: 30, rise: 1.06 }, { minutes: 60, rise: 1.16 },
  { minutes: 90, rise: 1.31 }, { minutes: 120, rise: 1.52 }, { minutes: 150, rise: 1.74 },
  { minutes: 180, rise: 1.93 }, { minutes: 210, rise: 2.06 }, { minutes: 240, rise: 2.13 },
  { minutes: 270, rise: 2.16 }, { minutes: 300, rise: 2.14 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proof</CardTitle>
        <CardDescription>The window, derived from the rate</CardDescription>
      </CardHeader>
      <CardContent>
        <ProofCurve readings={readings} targetRise={1.75} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ready is a rate, not a time on a card <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          24°C bulk
        </div>
      </CardFooter>
    </Card>
  )
}
