import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EpisodeRetention } from "@/components/charts/lib/podcast"
const episodes = [
  { name: "112 · The long interview", minutes: 74,
    retained: [1, 0.96, 0.93, 0.9, 0.87, 0.84, 0.81, 0.78, 0.75, 0.71, 0.68] },
  { name: "113 · News round-up", minutes: 32,
    retained: [1, 0.94, 0.88, 0.71, 0.66, 0.62, 0.59, 0.56, 0.53, 0.5, 0.47] },
  { name: "114 · Listener questions", minutes: 48,
    retained: [1, 0.95, 0.91, 0.88, 0.85, 0.82, 0.79, 0.75, 0.7, 0.64, 0.58] },
  { name: "115 · Live show", minutes: 96,
    retained: [1, 0.91, 0.82, 0.77, 0.73, 0.7, 0.67, 0.64, 0.61, 0.57, 0.52] },
]
const markers = [{ at: 0.12, label: "mid-roll 1" }, { at: 0.62, label: "mid-roll 2" }]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Listen-through</CardTitle>
        <CardDescription>Where the audience leaves</CardDescription>
      </CardHeader>
      <CardContent>
        <EpisodeRetention episodes={episodes} markers={markers} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A completion percentage carries none of this <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four episodes
        </div>
      </CardFooter>
    </Card>
  )
}
