import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeadcountBridge } from "@/components/charts/lib/hr"
const movements = [
  { label: "Hires", delta: 84 }, { label: "Resignations", delta: -52 },
  { label: "Redundancies", delta: -19 }, { label: "Transfers in", delta: 11 },
  { label: "Retirements", delta: -7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How headcount moved</CardTitle>
        <CardDescription>Not just the net</CardDescription>
      </CardHeader>
      <CardContent>
        <HeadcountBridge opening={395} movements={movements} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Net hides how much actually changed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One year
        </div>
      </CardFooter>
    </Card>
  )
}
