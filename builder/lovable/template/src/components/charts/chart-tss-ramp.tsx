import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TssRamp } from "@/components/charts/lib/cycling"
const weeks = [320, 340, 365, 390, 280, 410, 440, 470, 330, 520, 610, 660, 420, 690, 720, 500]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Training load</CardTitle>
        <CardDescription>The change, not the level</CardDescription>
      </CardHeader>
      <CardContent>
        <TssRamp weeks={weeks} safeRampPercent={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The same load reached in a fortnight is an injury <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Sixteen weeks
        </div>
      </CardFooter>
    </Card>
  )
}
