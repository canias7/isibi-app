import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CircleOfFifths } from "@/components/charts/lib/gamesmusic"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Circle of fifths</CardTitle>
        <CardDescription>Majors outside, relative minors inside</CardDescription>
      </CardHeader>
      <CardContent>
        <CircleOfFifths highlight={["G", "C", "D", "Em"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Neighbours share six of seven notes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          A blues progression in G
        </div>
      </CardFooter>
    </Card>
  )
}
