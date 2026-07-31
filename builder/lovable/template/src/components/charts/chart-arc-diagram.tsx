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

const nodes = [
  { id: "Cut", weight: 9 }, { id: "Wash", weight: 5 }, { id: "Beard", weight: 6 },
  { id: "Towel", weight: 3 }, { id: "Colour", weight: 4 }, { id: "Kids", weight: 2 },
]
const links = [
  { source: "Cut", target: "Beard", value: 8 },
  { source: "Cut", target: "Wash", value: 6 },
  { source: "Beard", target: "Towel", value: 4 },
  { source: "Colour", target: "Wash", value: 5 },
  { source: "Cut", target: "Kids", value: 1 },
  { source: "Wash", target: "Towel", value: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Arc Diagram</CardTitle>
        <CardDescription>Which services get booked together.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <ArcDiagram nodes={nodes} links={links} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut and beard is the common pair <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
