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

const tiles = sampleTiles(UK_TILES, 4)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dot Density Map</CardTitle>
        <CardDescription>One dot per ten customers.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <DotDensityMap tiles={tiles} per={10} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The North West is densest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
