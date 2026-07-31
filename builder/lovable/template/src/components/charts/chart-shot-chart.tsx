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

const shots = [
  { x: 48, y: 10, made: true }, { x: 55, y: 14, made: true }, { x: 42, y: 12, made: true },
  { x: 50, y: 20, made: true }, { x: 61, y: 24, made: false }, { x: 38, y: 26, made: true },
  { x: 22, y: 18, made: false }, { x: 16, y: 10, made: false }, { x: 14, y: 22, made: false },
  { x: 78, y: 16, made: true }, { x: 84, y: 24, made: false }, { x: 70, y: 34, made: true },
  { x: 52, y: 40, made: false }, { x: 34, y: 44, made: true }, { x: 64, y: 46, made: false },
  { x: 47, y: 52, made: false }, { x: 58, y: 55, made: true }, { x: 30, y: 55, made: false },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shot Chart</CardTitle>
        <CardDescription>Attempts on the half-court.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ShotChart shots={shots} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cold from the left corner <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
