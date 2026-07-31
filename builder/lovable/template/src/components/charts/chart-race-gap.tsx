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

const laps = 20
const drivers = [
  { label: "P1", gaps: Array.from({ length: 20 }, () => 0) },
  { label: "P2", gaps: Array.from({ length: 20 }, (_, i) => 4.5 - i * 0.14) },
  { label: "P3", gaps: Array.from({ length: 20 }, (_, i) => 6 + i * 0.32) },
  { label: "P4", gaps: Array.from({ length: 20 }, (_, i) => 8 + i * 0.55 + (i > 12 ? 9 : 0)) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Race Gap</CardTitle>
        <CardDescription>Seconds behind the leader, lap by lap.</CardDescription>
      </CardHeader>
      <CardContent>
        <RaceGap drivers={drivers} laps={laps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          P2 closed to under two seconds <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
