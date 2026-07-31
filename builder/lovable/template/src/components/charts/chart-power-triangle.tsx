import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PowerTriangle } from "@/components/charts/lib/power"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Real, reactive, apparent</CardTitle>
        <CardDescription>And the power factor they imply</CardDescription>
      </CardHeader>
      <CardContent>
        <PowerTriangle realKw={420} reactiveKvar={310} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          cos φ computed from the sides <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Site load
        </div>
      </CardFooter>
    </Card>
  )
}
