import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RoundRobin } from "@/components/charts/lib/gamesmusic"
const teams = ["Ash", "Bramble", "Cedar", "Dune"]
const results: (("W" | "D" | "L") | null)[][] = [
  [null, "W", "D", "W"],
  ["L", null, "W", "D"],
  ["D", "L", null, "W"],
  ["L", "D", "L", null],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>League results</CardTitle>
        <CardDescription>The grid, and the table counted from it</CardDescription>
      </CardHeader>
      <CardContent>
        <RoundRobin teams={teams} results={results} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Standings cannot disagree with the results <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three points for a win
        </div>
      </CardFooter>
    </Card>
  )
}
