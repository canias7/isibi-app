import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoudnessRange } from "@/components/charts/lib/music2"
const tracks = [
  { name: "Opening", lufs: -16.2, lra: 9.4, truePeakDb: -1.8 },
  { name: "Second light", lufs: -13.8, lra: 6.1, truePeakDb: -0.9 },
  { name: "Undertow", lufs: -9.4, lra: 3.2, truePeakDb: 0.4 },
  { name: "Ferrous", lufs: -11.1, lra: 4.8, truePeakDb: -0.2 },
  { name: "Slow water", lufs: -18.6, lra: 12.7, truePeakDb: -3.1 },
  { name: "Bright field", lufs: -8.9, lra: 2.6, truePeakDb: 1.1 },
  { name: "Closing", lufs: -14.4, lra: 8.2, truePeakDb: -1.4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loudness delivery</CardTitle>
        <CardDescription>Every track against the platform target</CardDescription>
      </CardHeader>
      <CardContent>
        <LoudnessRange tracks={tracks} targetLufs={-14} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two masters will be turned down <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          EBU R128
        </div>
      </CardFooter>
    </Card>
  )
}
