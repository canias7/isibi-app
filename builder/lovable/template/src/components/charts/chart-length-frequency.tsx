import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LengthFrequency } from "@/components/charts/lib/fisheries"
const bins = [
  { cm: 18, count: 12 }, { cm: 20, count: 34 }, { cm: 22, count: 78 }, { cm: 24, count: 146 },
  { cm: 26, count: 218 }, { cm: 28, count: 264 }, { cm: 30, count: 241 }, { cm: 32, count: 196 },
  { cm: 34, count: 152 }, { cm: 36, count: 108 }, { cm: 38, count: 71 }, { cm: 40, count: 44 },
  { cm: 42, count: 26 }, { cm: 44, count: 14 }, { cm: 46, count: 7 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Size structure</CardTitle>
        <CardDescription>The catch against the minimum size</CardDescription>
      </CardHeader>
      <CardContent>
        <LengthFrequency bins={bins} minSizeCm={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The modal class is a gear problem, not a bad tow <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One trip, sampled
        </div>
      </CardFooter>
    </Card>
  )
}
