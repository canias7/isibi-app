import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DownloadWindow } from "@/components/charts/lib/podcast"
const days = Array.from({ length: 25 }, (_, i) => {
  const day = i * 5
  const cumulative = Math.round(41000 * (1 - Math.exp(-day / 21)) + day * 46)
  return { day, cumulative }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Download window</CardTitle>
        <CardDescription>What a 30-day count is capturing</CardDescription>
      </CardHeader>
      <CardContent>
        <DownloadWindow days={days} windowDays={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everything past the line is audience nobody sells <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One episode, 120 days
        </div>
      </CardFooter>
    </Card>
  )
}
