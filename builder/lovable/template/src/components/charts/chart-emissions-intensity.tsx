import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmissionsIntensity } from "@/components/charts/lib/climate"
const years = Array.from({ length: 24 }, (_, i) => 2000 + i)
const output = years.map((_, i) => 100 * Math.pow(1.031, i))
const absolute = years.map((_, i) => Number((42 * Math.pow(1.012, i)).toFixed(1)))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Intensity against the total</CardTitle>
        <CardDescription>Both can move opposite ways</CardDescription>
      </CardHeader>
      <CardContent>
        <EmissionsIntensity years={years} absolute={absolute} output={output} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Falling intensity is not falling emissions <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One economy
        </div>
      </CardFooter>
    </Card>
  )
}
