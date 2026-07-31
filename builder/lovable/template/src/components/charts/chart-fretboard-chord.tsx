import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FretboardChord } from "@/components/charts/lib/gamesmusic"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chord shape</CardTitle>
        <CardDescription>Where the fingers go</CardDescription>
      </CardHeader>
      <CardContent>
        <FretboardChord
          name="Cmaj7"
          frets={[-1, 3, 2, 0, 0, 0]}
          fingers={[0, 3, 2, 0, 0, 0]}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One muted string, three played open <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Standard tuning
        </div>
      </CardFooter>
    </Card>
  )
}
