import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProgressionFunnel } from "@/components/charts/lib/gamedev"
const levels = [
  { name: "Install", players: 100000 }, { name: "Tutorial", players: 82000 },
  { name: "Level 1", players: 74000 }, { name: "Level 2", players: 68000 },
  { name: "Boss 1", players: 27000 }, { name: "Level 3", players: 24000 },
  { name: "Level 4", players: 21000 }, { name: "Boss 2", players: 16000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where players stop</CardTitle>
        <CardDescription>Level by level</CardDescription>
      </CardHeader>
      <CardContent>
        <ProgressionFunnel levels={levels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The steepest single drop is the fix <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          First hour
        </div>
      </CardFooter>
    </Card>
  )
}
