import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CostPerPound } from "@/components/charts/lib/fundraising"
const channels = [
  { name: "Legacy marketing", spend: 84000, raisedYearOne: 41000, annualValue: 96, retention: 0.94 },
  { name: "Face to face", spend: 310000, raisedYearOne: 148000, annualValue: 148, retention: 0.71 },
  { name: "Direct mail, warm", spend: 96000, raisedYearOne: 214000, annualValue: 62, retention: 0.82 },
  { name: "Direct mail, cold", spend: 142000, raisedYearOne: 88000, annualValue: 54, retention: 0.68 },
  { name: "Digital acquisition", spend: 78000, raisedYearOne: 61000, annualValue: 71, retention: 0.64 },
  { name: "Community events", spend: 44000, raisedYearOne: 92000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost of fundraising</CardTitle>
        <CardDescription>Year one against a lifetime</CardDescription>
      </CardHeader>
      <CardContent>
        <CostPerPound channels={channels} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The question is whether the charity can fund the payback <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Recruitment channels
        </div>
      </CardFooter>
    </Card>
  )
}
