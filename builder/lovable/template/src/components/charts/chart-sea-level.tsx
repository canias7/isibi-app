import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeaLevel } from "@/components/charts/lib/climate"
const years = Array.from({ length: 32 }, (_, i) => 1993 + i)
const contributions = [
  { name: "Thermal expansion", mm: years.map((_, i) => Number((i * 1.28).toFixed(1))) },
  { name: "Greenland", mm: years.map((_, i) => Number((i * i * 0.0032 + i * 0.24).toFixed(1))) },
  { name: "Antarctica", mm: years.map((_, i) => Number((i * i * 0.0021 + i * 0.11).toFixed(1))) },
  { name: "Glaciers", mm: years.map((_, i) => Number((i * 0.72).toFixed(1))) },
  { name: "Land water", mm: years.map((_, i) => Number((i * 0.14).toFixed(1))) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sea level and what causes it</CardTitle>
        <CardDescription>Contributions stacked</CardDescription>
      </CardHeader>
      <CardContent>
        <SeaLevel years={years} contributions={contributions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Different causes, different levers <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Since 1993
        </div>
      </CardFooter>
    </Card>
  )
}
