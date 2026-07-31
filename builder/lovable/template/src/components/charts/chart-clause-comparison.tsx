import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClauseComparison } from "@/components/charts/lib/legal"
const agreements = ["Draft 1", "Draft 3", "Draft 4", "Counterparty form"]
const terms = ["Indemnity", "Liability cap", "Termination", "IP assignment", "Assignment", "Governing law"]
const scores = [
  [0.9, 0.85, 0.7, 0.95, 0.6, 1],
  [0.75, 0.8, 0.72, 0.9, 0.6, 1],
  [0.42, 0.55, 0.68, 0.88, 0.55, 1],
  [0.2, 0.25, 0.4, 0.35, 0.3, 0.5],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clause comparison</CardTitle>
        <CardDescription>How favourable each term is in each draft</CardDescription>
      </CardHeader>
      <CardContent>
        <ClauseComparison agreements={agreements} terms={terms} scores={scores} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Draft 4 gave ground on indemnity <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1 is most favourable
        </div>
      </CardFooter>
    </Card>
  )
}
