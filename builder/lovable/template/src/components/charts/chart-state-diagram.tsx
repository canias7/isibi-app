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

const states = ["Draft", "Booked", "Seated", "Done", "Cancel"]
const transitions = [
  { from: "Draft", to: "Booked", label: "confirm" },
  { from: "Booked", to: "Seated", label: "arrive" },
  { from: "Seated", to: "Done", label: "finish" },
  { from: "Booked", to: "Cancel", label: "cancel" },
  { from: "Draft", to: "Cancel", label: "abandon" },
  { from: "Booked", to: "Booked", label: "move" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>State Diagram</CardTitle>
        <CardDescription>A booking's states and what moves it.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <StateDiagram states={states} transitions={transitions} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cancelled is reachable from anywhere <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
