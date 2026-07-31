import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScaleWheel } from "@/components/charts/lib/gamesmusic"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scale shape</CardTitle>
        <CardDescription>The interval pattern round twelve semitones</CardDescription>
      </CardHeader>
      <CardContent>
        <ScaleWheel root="D" name="dorian" semitones={[0, 2, 3, 5, 7, 9, 10]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two modes of one set look identical <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          D dorian
        </div>
      </CardFooter>
    </Card>
  )
}
