import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TideGate } from "@/components/charts/lib/sailing"
const hours = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
const heights = hours.map((_, i) => Math.round((2.9 + 2.4 * Math.sin(((i - 2) / 12.4) * Math.PI * 2)) * 10) / 10)
const streamKn = hours.map((_, i) => Math.round(2.6 * Math.sin(((i - 5) / 12.4) * Math.PI * 2) * 10) / 10)
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tidal gate</CardTitle>
        <CardDescription>Enough water and a fair stream, together</CardDescription>
      </CardHeader>
      <CardContent>
        <TideGate
          hours={hours}
          heights={heights}
          streamKn={streamKn}
          draughtM={2.1}
          chartDatumM={0.8}
          clearanceM={0.5}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A tide table shows neither constraint <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          2.1 m draught
        </div>
      </CardFooter>
    </Card>
  )
}
