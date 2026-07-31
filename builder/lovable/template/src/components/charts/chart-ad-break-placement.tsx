import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdBreakPlacement } from "@/components/charts/lib/podcast"
const retention = [1, 0.95, 0.91, 0.87, 0.83, 0.79, 0.74, 0.7, 0.65, 0.59, 0.53]
const breaks = [
  { at: 0.01, label: "Pre-roll" },
  { at: 0.24, label: "Mid-roll 1" },
  { at: 0.58, label: "Mid-roll 2" },
  { at: 0.97, label: "Post-roll" },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Break placement</CardTitle>
        <CardDescription>The audience each slot actually reaches</CardDescription>
      </CardHeader>
      <CardContent>
        <AdBreakPlacement
          retention={retention}
          breaks={breaks}
          episodeMinutes={62}
          cpm={24}
          listeners={38400}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A flat rate card overcharges on the late slots <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          62-minute episode
        </div>
      </CardFooter>
    </Card>
  )
}
