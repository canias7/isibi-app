import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WarmingPathways } from "@/components/charts/lib/climate"
const years = Array.from({ length: 9 }, (_, i) => 2020 + i * 10)
const mk = (name: string, end: number, spread: number) => ({
  name,
  central: years.map((_, i) => Number((1.1 + (end - 1.1) * (i / 8)).toFixed(2))),
  low: years.map((_, i) => Number((1.1 + (end - 1.1) * (i / 8) - spread * (i / 8)).toFixed(2))),
  high: years.map((_, i) => Number((1.1 + (end - 1.1) * (i / 8) + spread * (i / 8)).toFixed(2))),
})
const pathways = [mk("Very low", 1.5, 0.5), mk("Intermediate", 2.7, 0.9), mk("High", 4.4, 1.5)]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projected warming</CardTitle>
        <CardDescription>Ranges, not lines</CardDescription>
      </CardHeader>
      <CardContent>
        <WarmingPathways years={years} pathways={pathways} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The bands overlap for decades <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four scenarios
        </div>
      </CardFooter>
    </Card>
  )
}
