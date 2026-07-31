import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TriageOutcome } from "@/components/charts/lib/emergency"
const categories = ["Category 1", "Category 2", "Category 3", "Category 4"]
const outcomes = ["Resuscitation", "Admitted, urgent", "Admitted, routine", "Treated on scene", "No further action"]
const counts = [
  [148, 402, 210, 96, 44],
  [96, 1240, 1860, 940, 264],
  [12, 210, 940, 1620, 618],
  [2, 41, 218, 940, 1299],
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage against outcome</CardTitle>
        <CardDescription>Assigned in seconds, judged on what was found</CardDescription>
      </CardHeader>
      <CardContent>
        <TriageOutcome
          categories={categories}
          outcomes={outcomes}
          counts={counts}
          seriousFrom={1}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Over-triage is the safe direction and it is not free <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
