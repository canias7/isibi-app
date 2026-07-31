import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChessHeat } from "@/components/charts/lib/gamesmusic"
const counts = [
  [1, 0, 2, 3, 4, 2, 0, 1],
  [3, 4, 5, 6, 7, 5, 4, 3],
  [2, 3, 6, 9, 11, 7, 3, 2],
  [1, 4, 8, 14, 16, 9, 4, 1],
  [1, 5, 9, 15, 17, 10, 5, 1],
  [2, 4, 7, 10, 12, 8, 4, 2],
  [3, 5, 6, 7, 8, 6, 5, 3],
  [1, 0, 3, 4, 5, 3, 0, 1],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Square occupancy</CardTitle>
        <CardDescription>Where the pieces spent the game</CardDescription>
      </CardHeader>
      <CardContent>
        <ChessHeat counts={counts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The centre, as it always is <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One master game
        </div>
      </CardFooter>
    </Card>
  )
}
