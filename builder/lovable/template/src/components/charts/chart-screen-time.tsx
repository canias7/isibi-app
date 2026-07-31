import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScreenTime } from "@/components/charts/lib/media"
const characters = ["Mara", "Ivo", "Delacroix", "The Boy", "Nan"]
const scenes = Array.from({ length: 18 }, (_, i) => `sc${i + 1}`)
const P = [
  [3,0,4,2,0,5,1,0,3,2,4,0,6,1,0,3,2,4],
  [3,2,0,2,4,0,1,3,3,0,4,2,6,0,2,3,0,4],
  [0,0,0,0,0,0,0,9,0,0,0,0,0,8,0,0,0,7],
  [0,2,4,0,0,5,0,0,0,2,0,0,0,0,2,0,0,0],
  [0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,1,0],
]
const grid = P

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is on screen</CardTitle>
        <CardDescription>Minutes and scene count</CardDescription>
      </CardHeader>
      <CardContent>
        <ScreenTime characters={characters} scenes={scenes} grid={grid} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Minutes and presence are different claims <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Act one
        </div>
      </CardFooter>
    </Card>
  )
}
