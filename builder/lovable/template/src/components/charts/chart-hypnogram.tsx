import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Hypnogram } from "@/components/charts/lib/med2"
type Stage = "wake" | "rem" | "n1" | "n2" | "n3"
const rep = (n: number, v: Stage): Stage[] => Array<Stage>(n).fill(v)
// Five cycles of about 90 minutes: deep sleep front-loaded, REM lengthening.
const cycle = (deep: number, rem: number): Stage[] => [
  ...rep(8, "n1"), ...rep(70, "n2"), ...rep(deep, "n3"),
  ...rep(50, "n2"), ...rep(rem, "rem"), ...rep(4, "wake"),
]
const epochs: Stage[] = [
  ...rep(14, "wake"),
  ...cycle(90, 14), ...cycle(70, 34), ...cycle(36, 66), ...cycle(14, 90),
  ...rep(16, "wake"),
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A night's sleep</CardTitle>
        <CardDescription>Stage by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <Hypnogram epochs={epochs} minutesPerEpoch={0.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          REM lengthens toward morning <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight hours
        </div>
      </CardFooter>
    </Card>
  )
}
