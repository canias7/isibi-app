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
        <CardDescription>With counts printed.</CardDescription>
      </CardHeader>
      <CardContent>
        <Histogram values={values} showCounts format={(n) => n + "m"} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          62 appointments in the modal bin <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
