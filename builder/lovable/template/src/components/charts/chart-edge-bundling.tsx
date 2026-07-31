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

const ids = ["Ada", "Mo", "Sam", "Rae", "Jo", "Kit", "Lee", "Eve", "Ivy", "Ola", "Ren", "Tam"]
const nodes = ids.map((id) => ({ id }))
const links = ids.flatMap((id, i) =>
  [4, 7, 9].map((step) => ({ source: id, target: ids[(i + step) % ids.length], value: 1 + (i % 3) }))
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edge Bundling</CardTitle>
        <CardDescription>The same links, pulled into strands.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <EdgeBundling nodes={nodes} links={links} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two clear routes through the middle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
