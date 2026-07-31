import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AbandonCurve } from "@/components/charts/lib/contact"
const buckets = [
  { toSeconds: 10, answered: 2840, abandoned: 18 },
  { toSeconds: 20, answered: 2210, abandoned: 46 },
  { toSeconds: 30, answered: 1420, abandoned: 112 },
  { toSeconds: 45, answered: 960, abandoned: 186 },
  { toSeconds: 60, answered: 610, abandoned: 214 },
  { toSeconds: 90, answered: 340, abandoned: 168 },
  { toSeconds: 120, answered: 170, abandoned: 94 },
  { toSeconds: 180, answered: 82, abandoned: 41 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patience</CardTitle>
        <CardDescription>How long a caller waits before hanging up</CardDescription>
      </CardHeader>
      <CardContent>
        <AbandonCurve buckets={buckets} targetSeconds={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An average wait is computed over the people who stayed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week, 9,400 calls
        </div>
      </CardFooter>
    </Card>
  )
}
