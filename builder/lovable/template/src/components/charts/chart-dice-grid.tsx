import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DiceGrid } from "@/components/charts/lib/gamesmusic"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Two dice</CardTitle>
        <CardDescription>All 36 outcomes, and the sums they make</CardDescription>
      </CardHeader>
      <CardContent>
        <DiceGrid highlight={[7]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Seven has six ways, twelve has one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Equally likely rolls
        </div>
      </CardFooter>
    </Card>
  )
}
