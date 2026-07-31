import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LapseCurve } from "@/components/charts/lib/insure"
const points = Array.from({ length: 16 }, (_, y) => ({
  year: y,
  inForce: Math.round(10000 * Math.pow(0.94, y) * (y === 0 ? 1 : 0.82)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Policies still in force</CardTitle>
        <CardDescription>By duration since issue</CardDescription>
      </CardHeader>
      <CardContent>
        <LapseCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The first year does most of the damage <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One cohort
        </div>
      </CardFooter>
    </Card>
  )
}
