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

const rows = [
  { label: "Mon", value: 38 },
  { label: "Wed", value: 41 },
  { label: "Fri", value: 78 },
  { label: "Sat", value: 94 },
  { label: "Sun", value: 12 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pictogram</CardTitle>
        <CardDescription>Countable units rather than a bar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Pictogram rows={rows} per={5} glyph="✂" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday takes twice Monday's bookings <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
