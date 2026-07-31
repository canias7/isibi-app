import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AccessibilityLadder } from "@/components/charts/lib/transit2"
const stations = ["Ashby", "Beeston", "Carlow", "Denton", "Eastcote", "Fairhill", "Gorse", "Halden"]
const steps = [
  { name: "Street to concourse", provided: [true, true, true, true, false, true, true, true] },
  { name: "Concourse to platform", provided: [true, false, true, true, true, true, false, true] },
  { name: "Platform to train", provided: [true, true, false, true, true, true, true, true] },
  { name: "Accessible toilet", provided: [true, true, true, false, true, true, true, true] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step-free chain</CardTitle>
        <CardDescription>Every link between street and train</CardDescription>
      </CardHeader>
      <CardContent>
        <AccessibilityLadder stations={stations} steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One missing lift breaks five stations <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Line audit
        </div>
      </CardFooter>
    </Card>
  )
}
