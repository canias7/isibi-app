import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GearRatios } from "@/components/charts/lib/cycling"
const chainrings = [52, 36]
const sprockets = [11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 32]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gearing</CardTitle>
        <CardDescription>Every combination's development</CardDescription>
      </CardHeader>
      <CardContent>
        <GearRatios chainrings={chainrings} sprockets={sprockets} wheelCircumferenceMm={2096} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Eight of them nobody can feel apart <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          2×11
        </div>
      </CardFooter>
    </Card>
  )
}
