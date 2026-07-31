import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MatchLength } from "@/components/charts/lib/gamedev"
const buckets = Array.from({ length: 30 }, (_, i) => {
  const minutes = i + 1
  const peak = Math.exp(-((minutes - 11) ** 2) / 26) * 2400
  const tail = minutes > 16 ? 260 * Math.exp(-(minutes - 16) / 9) : 0
  return { minutes, matches: Math.round(peak + tail) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How long a match runs</CardTitle>
        <CardDescription>Against the target window</CardDescription>
      </CardHeader>
      <CardContent>
        <MatchLength buckets={buckets} targetFrom={8} targetTo={15} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The long tail is what people quit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One mode
        </div>
      </CardFooter>
    </Card>
  )
}
