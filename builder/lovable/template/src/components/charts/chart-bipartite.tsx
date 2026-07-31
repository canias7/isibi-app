import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HivePlot, Bipartite, VoronoiMap, FlameGraph, EdgeBundling, CoOccurrence } from "./lib/graphs"

const left = ["Rae", "Jo", "Kit", "Mo"]
const right = ["Cut", "Beard", "Colour", "Towel", "Kids"]
const links = [
  { from: "Rae", to: "Cut", value: 9 }, { from: "Rae", to: "Colour", value: 6 },
  { from: "Jo", to: "Cut", value: 7 }, { from: "Jo", to: "Beard", value: 8 },
  { from: "Kit", to: "Beard", value: 4 }, { from: "Kit", to: "Towel", value: 5 },
  { from: "Mo", to: "Cut", value: 6 }, { from: "Mo", to: "Kids", value: 7 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bipartite</CardTitle>
        <CardDescription>Which stylist does which service.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Bipartite left={left} right={right} links={links} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Only Rae does colour <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
