import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DocketTimeline } from "@/components/charts/lib/legal"
const entries = [
  { day: 0, label: "Complaint filed", kind: "filing" as const },
  { day: 21, label: "Answer", kind: "filing" as const },
  { day: 45, label: "Scheduling conference", kind: "hearing" as const },
  { day: 60, label: "Initial disclosures", kind: "order" as const, dueDay: 74 },
  { day: 140, label: "Fact discovery closes", kind: "order" as const, dueDay: 140 },
  { day: 175, label: "Expert reports", kind: "order" as const, dueDay: 189 },
  { day: 210, label: "Summary judgment", kind: "filing" as const },
  { day: 265, label: "Motion heard", kind: "hearing" as const },
  { day: 330, label: "Pre-trial order", kind: "order" as const, dueDay: 344 },
  { day: 360, label: "Trial", kind: "hearing" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Case docket</CardTitle>
        <CardDescription>Filings, orders and hearings through the matter</CardDescription>
      </CardHeader>
      <CardContent>
        <DocketTimeline entries={entries} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The gap before trial is where the work is <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Complaint to judgment
        </div>
      </CardFooter>
    </Card>
  )
}
