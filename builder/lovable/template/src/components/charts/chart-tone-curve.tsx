import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToneCurve } from "@/components/charts/lib/printing"
const points = [
  { input: 0, output: 0 }, { input: 10, output: 6 }, { input: 25, output: 19 },
  { input: 40, output: 38 }, { input: 50, output: 52 }, { input: 60, output: 66 },
  { input: 75, output: 84 }, { input: 90, output: 95 }, { input: 100, output: 100 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tone reproduction</CardTitle>
        <CardDescription>The contrast each quarter-tone gets</CardDescription>
      </CardHeader>
      <CardContent>
        <ToneCurve points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every expansion is paid for somewhere <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Input to output
        </div>
      </CardFooter>
    </Card>
  )
}
