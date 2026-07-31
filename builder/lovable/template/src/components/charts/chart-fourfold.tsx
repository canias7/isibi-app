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

const labels = { rows: ["Reminded", "Not reminded"], cols: ["Kept", "Missed"] }
const counts = [
  [438, 22],
  [301, 71],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fourfold Plot</CardTitle>
        <CardDescription>A 2×2 as quarter-circles, area to count.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <FourfoldPlot labels={labels} counts={counts} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Reminded customers keep their slot <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
