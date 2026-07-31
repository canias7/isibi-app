import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MaturityLadder } from "@/components/charts/lib/strategy"
const practices = [
  { name: "Automated tests", level: 3, target: 4 },
  { name: "Continuous delivery", level: 4, target: 4 },
  { name: "Observability", level: 1, target: 3 },
  { name: "Incident review", level: 2, target: 3 },
  { name: "Threat modelling", level: 0, target: 2 },
  { name: "Code review", level: 4, target: 4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engineering practices</CardTitle>
        <CardDescription>Where each sits, and where it should</CardDescription>
      </CardHeader>
      <CardContent>
        <MaturityLadder
          levels={["None", "Ad hoc", "Repeatable", "Managed", "Optimising"]}
          practices={practices}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Four practices short of target <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Assessed quarterly
        </div>
      </CardFooter>
    </Card>
  )
}
