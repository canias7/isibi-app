import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DifficultyCurve } from "@/components/charts/lib/gamedev"
const points = [
  { stage: "Tut", challenge: 1, skill: 1 }, { stage: "A1", challenge: 2, skill: 2.1 },
  { stage: "A2", challenge: 3.2, skill: 3 }, { stage: "B1", challenge: 6.4, skill: 3.6 },
  { stage: "B2", challenge: 4.4, skill: 4.4 }, { stage: "C1", challenge: 4.6, skill: 6.2 },
  { stage: "C2", challenge: 6.8, skill: 6.6 }, { stage: "Boss", challenge: 9.6, skill: 7.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Challenge against skill</CardTitle>
        <CardDescription>Where flow breaks</CardDescription>
      </CardHeader>
      <CardContent>
        <DifficultyCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Both gaps are failures <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One playthrough
        </div>
      </CardFooter>
    </Card>
  )
}
