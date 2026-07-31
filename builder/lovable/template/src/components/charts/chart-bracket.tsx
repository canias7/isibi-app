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

const roundLabels = ["Quarter-finals", "Semi-finals", "Final", "Champion"]
const rounds = [
  [
    { a: "Fade FC", b: "Trim Town", scoreA: 3, scoreB: 1 },
    { a: "Clipper", b: "Shear Utd", scoreA: 2, scoreB: 2.1 },
    { a: "Razor", b: "Comb City", scoreA: 1, scoreB: 0 },
    { a: "Buzz", b: "Styler", scoreA: 0, scoreB: 2 },
  ],
  [
    { a: "Fade FC", b: "Shear Utd", scoreA: 1, scoreB: 2 },
    { a: "Razor", b: "Styler", scoreA: 0, scoreB: 1 },
  ],
  [
    { a: "Shear Utd", b: "Styler", scoreA: 1, scoreB: 3 },
  ],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bracket</CardTitle>
        <CardDescription>An eight-team knockout, winners derived from scores.</CardDescription>
      </CardHeader>
      <CardContent>
        <Bracket rounds={rounds} roundLabels={roundLabels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The four seed goes all the way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
