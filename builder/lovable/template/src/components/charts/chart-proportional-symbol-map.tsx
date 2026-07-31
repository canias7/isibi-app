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

const tiles = sampleTiles(UK_TILES, 12)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proportional Symbol Map</CardTitle>
        <CardDescription>A circle per region, area to scale.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ProportionalSymbolMap tiles={tiles} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          London is the largest circle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
