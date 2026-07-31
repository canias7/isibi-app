import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StormCone } from "@/components/charts/lib/weather2"
const track = [
  { x: 18, y: 84, hour: 0, errorRadius: 3, category: "TS" },
  { x: 28, y: 72, hour: 24, errorRadius: 7, category: "1" },
  { x: 40, y: 60, hour: 48, errorRadius: 12, category: "2" },
  { x: 54, y: 46, hour: 72, errorRadius: 18, category: "3" },
  { x: 70, y: 32, hour: 96, errorRadius: 25, category: "2" },
  { x: 84, y: 20, hour: 120, errorRadius: 31, category: "1" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Track forecast</CardTitle>
        <CardDescription>Centre position and its uncertainty</CardDescription>
      </CardHeader>
      <CardContent>
        <StormCone track={track} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The cone is the centre, not the storm <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five-day outlook
        </div>
      </CardFooter>
    </Card>
  )
}
