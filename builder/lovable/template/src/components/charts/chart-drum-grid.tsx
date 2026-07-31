import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DrumGrid } from "@/components/charts/lib/craft"
const at = (steps: number[], v = 1) =>
  Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? v : 0))
const tracks = [
  { name: "Kick", hits: at([0, 6, 8, 14]) },
  { name: "Snare", hits: at([4, 12]) },
  { name: "Hi-hat", hits: Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 0.9 : 0.4)) },
  { name: "Clap", hits: at([12], 0.7) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step sequencer</CardTitle>
        <CardDescription>Sixteen steps, four tracks</CardDescription>
      </CardHeader>
      <CardContent>
        <DrumGrid tracks={tracks} steps={16} bpm={124} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Beat lines every four, or it cannot be counted <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One bar loop
        </div>
      </CardFooter>
    </Card>
  )
}
