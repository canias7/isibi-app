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

const root = {
  branches: [
    { label: "Books", p: 0.6, branches: [
      { label: "Attends", p: 0.9 },
      { label: "No-show", p: 0.1 },
    ] },
    { label: "Walks in", p: 0.4, branches: [
      { label: "Served", p: 0.7 },
      { label: "Turned away", p: 0.3 },
    ] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Probability Tree</CardTitle>
        <CardDescription>Two stages, leaves multiplied out.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProbabilityTree root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most likely path: books and turns up <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
