import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AndonBoard } from "@/components/charts/lib/mfg"
const lines = [
  { name: "Line 1", state: "running" as const },
  { name: "Line 2", state: "slow" as const, note: "material feed", minutes: 18 },
  { name: "Line 3", state: "stopped" as const, note: "tool change", minutes: 34 },
  { name: "Line 4", state: "running" as const },
  { name: "Line 5", state: "running" as const },
  { name: "Line 6", state: "stopped" as const, note: "awaiting QC", minutes: 12 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Line status</CardTitle>
        <CardDescription>What the floor sees from across the room</CardDescription>
      </CardHeader>
      <CardContent>
        <AndonBoard lines={lines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every state carries a glyph as well as a fill <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Live
        </div>
      </CardFooter>
    </Card>
  )
}
