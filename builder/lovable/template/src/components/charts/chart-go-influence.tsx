import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GoInfluence } from "@/components/charts/lib/gamesmusic"
const stones = [
  { x: 2, y: 2, colour: "black" as const },
  { x: 2, y: 6, colour: "black" as const },
  { x: 4, y: 4, colour: "black" as const },
  { x: 6, y: 2, colour: "white" as const },
  { x: 6, y: 6, colour: "white" as const },
  { x: 7, y: 4, colour: "white" as const },
  { x: 3, y: 7, colour: "black" as const },
  { x: 5, y: 1, colour: "white" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Influence</CardTitle>
        <CardDescription>Territory each side's stones project</CardDescription>
      </CardHeader>
      <CardContent>
        <GoInfluence size={9} stones={stones} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Shading halves with every point of distance <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          9×9 board
        </div>
      </CardFooter>
    </Card>
  )
}
