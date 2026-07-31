import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SceneHeat } from "@/components/charts/lib/media"
let s = 53
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const scenes = Array.from({ length: 62 }, (_, i) => ({
  n: i + 1,
  minutes: Number((0.6 + r() * 3.2).toFixed(2)),
  intExt: (r() > 0.45 ? "INT" : "EXT") as "INT" | "EXT",
  night: r() > 0.68,
}))
const acts = [{ atMinute: 26, name: "Act II" }, { atMinute: 78, name: "Act III" }]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenes across the running time</CardTitle>
        <CardDescription>Length, interior and night</CardDescription>
      </CardHeader>
      <CardContent>
        <SceneHeat scenes={scenes} acts={acts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Night exteriors are the shooting cost <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          With act breaks
        </div>
      </CardFooter>
    </Card>
  )
}
