import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeadwayChart } from "@/components/charts/lib/strategy"
const departures = [0, 9, 11, 24, 33, 35, 36, 48, 58, 60, 77, 86]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gaps between buses</CardTitle>
        <CardDescription>Against a ten-minute headway</CardDescription>
      </CardHeader>
      <CardContent>
        <HeadwayChart departures={departures} scheduled={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Bunching causes the long waits beside it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One hour, route 12
        </div>
      </CardFooter>
    </Card>
  )
}
