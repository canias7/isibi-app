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

const root = {
  name: "load",
  children: [
    { name: "boot", value: 40, children: [{ name: "parse", value: 24 }, { name: "hydrate", value: 16 }] },
    { name: "fetch rows", value: 120, children: [
      { name: "connect", value: 30 },
      { name: "query", value: 70, children: [{ name: "scan", value: 44 }, { name: "sort", value: 26 }] },
      { name: "decode", value: 20 },
    ] },
    { name: "render", value: 60, children: [{ name: "layout", value: 34 }, { name: "paint", value: 26 }] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flame Graph</CardTitle>
        <CardDescription>Where the page load actually goes.</CardDescription>
      </CardHeader>
      <CardContent>
        <FlameGraph root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half the time is in the data call <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
