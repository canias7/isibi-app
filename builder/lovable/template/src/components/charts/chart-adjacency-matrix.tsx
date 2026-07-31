import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Waffle, Pictogram, CirclePacking, NestedArea, Icicle, ArcDiagram, Alluvial, Dendrogram, OrgChart, AdjacencyMatrix } from "./lib/hierarchy"

const labels = ["Cut", "Beard", "Colour", "Wash", "Towel"]
const matrix = [
  [0, 18, 4, 22, 9],
  [14, 0, 2, 8, 11],
  [6, 3, 0, 12, 2],
  [17, 6, 9, 0, 4],
  [7, 9, 1, 5, 0],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adjacency Matrix</CardTitle>
        <CardDescription>The same pairings as a grid — no crossing lines.</CardDescription>
      </CardHeader>
      <CardContent>
        <AdjacencyMatrix labels={labels} matrix={matrix} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut connects to everything <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
