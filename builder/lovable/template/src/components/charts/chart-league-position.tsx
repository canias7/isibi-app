import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShotChart, WinProbability, RaceGap, Bracket, LeaguePosition } from "./lib/sport"

const teams = [
  { label: "Fade FC", positions: [8, 6, 7, 5, 4, 3, 3, 2, 2, 2] },
  { label: "Clipper", positions: [1, 1, 2, 2, 3, 4, 4, 5, 4, 4] },
  { label: "Razor", positions: [14, 15, 13, 14, 12, 13, 11, 10, 9, 8] },
  { label: "Buzz", positions: [10, 12, 15, 16, 17, 16, 17, 17, 18, 18] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>League Position</CardTitle>
        <CardDescription>Position by matchday, zones shaded.</CardDescription>
      </CardHeader>
      <CardContent>
        <LeaguePosition teams={teams} rounds={10} size={20} highlight="Fade FC" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Clear of the drop with two to play <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
