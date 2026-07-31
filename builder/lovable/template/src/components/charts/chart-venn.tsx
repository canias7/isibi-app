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
  { label: "Cut", count: 240 },
  { label: "Beard", count: 96 },
  { label: "Wash", count: 74 },
]
const overlaps = { "0&1": 88, "0&2": 64, "1&2": 22, "0&1&2": 41 }

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Venn Diagram</CardTitle>
        <CardDescription>Three services and who books which.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <VennDiagram sets={sets} overlaps={overlaps} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Forty-one book all three <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
