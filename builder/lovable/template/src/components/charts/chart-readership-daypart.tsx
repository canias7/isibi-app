import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReadershipDaypart } from "@/components/charts/lib/publish"
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const grid = days.map((_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const weekday = d < 5
    const commute = weekday ? 90 * Math.exp(-((h - 8) ** 2) / 3) + 70 * Math.exp(-((h - 18) ** 2) / 4) : 0
    const evening = 60 * Math.exp(-((h - 21) ** 2) / 6)
    const lazy = weekday ? 0 : 80 * Math.exp(-((h - 10) ** 2) / 10)
    return Math.round(commute + evening + lazy + 8)
  }),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>When people read</CardTitle>
        <CardDescription>Day against hour</CardDescription>
      </CardHeader>
      <CardContent>
        <ReadershipDaypart days={days} grid={grid} publishHours={[7, 12, 17]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Publish where the readers are <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week
        </div>
      </CardFooter>
    </Card>
  )
}
