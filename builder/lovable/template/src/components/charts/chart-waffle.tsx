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

const parts = [
  { label: "Haircut", value: 412 },
  { label: "Beard", value: 266 },
  { label: "Towel", value: 139 },
  { label: "Colour", value: 96 },
  { label: "Kids", value: 64 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waffle</CardTitle>
        <CardDescription>One square is one percent.</CardDescription>
      </CardHeader>
      <CardContent>
        <Waffle parts={parts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Haircuts are 42 squares <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
