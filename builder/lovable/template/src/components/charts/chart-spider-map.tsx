import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DotDensityMap, ProportionalSymbolMap, SpiderMap, IsotypeMap, sampleTiles, UK_TILES } from "./lib/maps2"

const hub = { id: "LON", row: 4, col: 3 }
const spokes = [
  { id: "SE", row: 4, col: 4, value: 88 },
  { id: "EE", row: 3, col: 4, value: 64 },
  { id: "SW", row: 4, col: 1, value: 31 },
  { id: "EM", row: 3, col: 3, value: 42 },
  { id: "WM", row: 3, col: 2, value: 26 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spider Map</CardTitle>
        <CardDescription>Where the customers travel in from.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SpiderMap hub={hub} spokes={spokes} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two regions supply most of them <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
