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

const stages = [
  { label: "2023", nodes: [{ id: "Regular", value: 320 }, { id: "Occasional", value: 210 }, { id: "New", value: 140 }] },
  { label: "2024", nodes: [{ id: "Regular", value: 360 }, { id: "Occasional", value: 205 }, { id: "Lapsed", value: 105 }] },
]
const flows = [
  { stage: 0, from: "Regular", to: "Regular", value: 240 },
  { stage: 0, from: "Regular", to: "Occasional", value: 55 },
  { stage: 0, from: "Regular", to: "Lapsed", value: 25 },
  { stage: 0, from: "Occasional", to: "Regular", value: 80 },
  { stage: 0, from: "Occasional", to: "Occasional", value: 90 },
  { stage: 0, from: "Occasional", to: "Lapsed", value: 40 },
  { stage: 0, from: "New", to: "Regular", value: 40 },
  { stage: 0, from: "New", to: "Occasional", value: 60 },
  { stage: 0, from: "New", to: "Lapsed", value: 40 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alluvial</CardTitle>
        <CardDescription>How last year's customers re-sorted themselves.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Alluvial stages={stages} flows={flows} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most regulars stayed regular <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
