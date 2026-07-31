import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EgressFlow } from "@/components/charts/lib/events"
const exits = [
  { name: "Main foyer", widthMm: 3300, crowdShare: 0.52 },
  { name: "Side, east", widthMm: 1650, crowdShare: 0.24 },
  { name: "Side, west", widthMm: 1650, crowdShare: 0.16 },
  { name: "Stage door", widthMm: 1100, crowdShare: 0.08 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Egress</CardTitle>
        <CardDescription>The venue clears when the last exit clears</CardDescription>
      </CardHeader>
      <CardContent>
        <EgressFlow exits={exits} attendance={4200} targetMinutes={8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It clears in 4.5 of the 8 minutes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          8-minute target
        </div>
      </CardFooter>
    </Card>
  )
}
