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
  name: "All revenue",
  children: [
    { name: "Cuts", children: [{ name: "Fade", value: 250 }, { name: "Trim", value: 162 }, { name: "Kids", value: 64 }] },
    { name: "Grooming", children: [{ name: "Beard", value: 266 }, { name: "Towel", value: 139 }] },
    { name: "Colour", children: [{ name: "Full", value: 96 }, { name: "Highlights", value: 58 }] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Circle Packing</CardTitle>
        <CardDescription>Groups sized by revenue, nested.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <CirclePacking root={root} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cuts are the biggest circle <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
