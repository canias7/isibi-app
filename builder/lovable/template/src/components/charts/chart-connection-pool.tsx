import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConnectionPool } from "@/components/charts/lib/dbperf"
const samples = Array.from({ length: 60 }, (_, i) => {
  const load = 8 + Math.sin(i / 6) * 6 + (i > 34 && i < 46 ? 14 : 0)
  const inUse = Math.min(20, Math.round(load))
  return { t: `${i}m`, inUse, idle: 20 - inUse, waiting: Math.max(0, Math.round(load) - 20) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool saturation</CardTitle>
        <CardDescription>In use, idle and queueing</CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectionPool samples={samples} poolSize={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Anything above the line is waiting <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One hour
        </div>
      </CardFooter>
    </Card>
  )
}
