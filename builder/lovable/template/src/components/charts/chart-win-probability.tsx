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

const points = [0.5, 0.54, 0.58, 0.52, 0.47, 0.42, 0.38, 0.45, 0.51, 0.56, 0.5, 0.44, 0.4, 0.36, 0.42, 0.48, 0.55, 0.62, 0.58, 0.66, 0.74, 0.85, 0.93, 1]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Probability</CardTitle>
        <CardDescription>The in-game swing, minute by minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <WinProbability points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Decided only in the final minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
