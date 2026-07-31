import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VennDiagram, UpSetPlot, FourfoldPlot, ProbabilityTree, StateDiagram } from "./lib/sets"

const sets = [
  { label: "Cut", size: 412 }, { label: "Beard", size: 266 },
  { label: "Wash", size: 231 }, { label: "Colour", size: 184 },
]
const intersections = [
  { members: [0], size: 118 }, { members: [0, 2], size: 96 },
  { members: [0, 1], size: 84 }, { members: [1], size: 62 },
  { members: [0, 1, 2], size: 48 }, { members: [3], size: 44 },
  { members: [2, 3], size: 31 }, { members: [0, 3], size: 22 },
  { members: [0, 1, 2, 3], size: 9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>UpSet Plot</CardTitle>
        <CardDescription>Set intersections that stay readable past three sets.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpSetPlot sets={sets} intersections={intersections} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut-and-wash is the biggest combination <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
