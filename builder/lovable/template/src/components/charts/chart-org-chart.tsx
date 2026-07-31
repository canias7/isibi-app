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

const root = {
  name: "Ada — owner",
  children: [
    { name: "Chair 1", children: [{ name: "Mo" }, { name: "Sam" }] },
    { name: "Chair 2", children: [{ name: "Rae" }] },
    { name: "Front desk", children: [{ name: "Jo" }, { name: "Kit" }] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Org Chart</CardTitle>
        <CardDescription>Who reports to whom.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrgChart root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three chairs, one front desk <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
