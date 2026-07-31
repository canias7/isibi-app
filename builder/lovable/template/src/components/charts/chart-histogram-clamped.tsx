import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Histogram, sampleValues } from "./lib/histogram"

const values = sampleValues(400, 40, 14, 5)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histogram</CardTitle>
        <CardDescription>Clamped to opening hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <Histogram values={values} min={0} max={90} format={(n) => n + "m"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing over 90 minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
