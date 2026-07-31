import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReleaseWindow } from "@/components/charts/lib/media"
const weeks = Array.from({ length: 16 }, (_, i) => `w${i + 1}`)
const windows = [
  { name: "Theatrical", revenue: weeks.map((_, i) => Math.round(42_000_000 * Math.exp(-i / 2.6))) },
  { name: "Premium rental", revenue: weeks.map((_, i) => (i < 4 ? 0 : Math.round(9_000_000 * Math.exp(-(i - 4) / 4)))) },
  { name: "Streaming", revenue: weeks.map((_, i) => (i < 8 ? 0 : Math.round(6_400_000 * (1 - Math.exp(-(i - 8) / 3))))) },
  { name: "Broadcast", revenue: weeks.map((_, i) => (i < 12 ? 0 : 2_800_000)) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by window</CardTitle>
        <CardDescription>Theatrical, then everything else</CardDescription>
      </CardHeader>
      <CardContent>
        <ReleaseWindow weeks={weeks} windows={windows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The crossover is the whole argument <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Sixteen weeks
        </div>
      </CardFooter>
    </Card>
  )
}
