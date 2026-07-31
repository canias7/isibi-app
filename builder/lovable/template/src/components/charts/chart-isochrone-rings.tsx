import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IsochroneRings } from "@/components/charts/lib/transit2"
const bands = [
  { minutes: 15, population: 42000 },
  { minutes: 30, population: 148000 },
  { minutes: 45, population: 290000 },
  { minutes: 60, population: 331000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reachable population</CardTitle>
        <CardDescription>Who can get here inside each travel time</CardDescription>
      </CardHeader>
      <CardContent>
        <IsochroneRings bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fourth ring adds almost nobody <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Public transport, AM peak
        </div>
      </CardFooter>
    </Card>
  )
}
