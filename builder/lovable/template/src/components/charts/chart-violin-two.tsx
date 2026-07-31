import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ViolinPlot, sampleViolins } from "./lib/violin"

const violins = sampleViolins(["Weekday", "Weekend"], 15)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Violin</CardTitle>
        <CardDescription>Weekday against weekend.</CardDescription>
      </CardHeader>
      <CardContent>
        <ViolinPlot violins={violins} showBox />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Weekends are bimodal <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
