import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PipelineDiversity } from "@/components/charts/lib/recruiting"
const stages = ["Applied", "Screened", "Interviewed", "Offered", "Hired"]
const groups = ["Group A", "Group B", "Group C"]
const counts = [
  [2840, 640, 214, 68, 44],
  [1960, 402, 96, 31, 21],
  [1210, 268, 74, 24, 16],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
        <CardDescription>Composition, with the pass rate into each stage</CardDescription>
      </CardHeader>
      <CardContent>
        <PipelineDiversity stages={stages} groups={groups} counts={counts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Narrowing evenly needs more applicants, unevenly needs a different stage <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
