import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmergencyMix } from "@/components/charts/lib/fieldservice"
const months = [
  { label: "Aug", plannedJobs: 148, reactiveJobs: 41, plannedValue: 32560, reactiveValue: 17630, plannedDeferred: 9 },
  { label: "Sep", plannedJobs: 156, reactiveJobs: 48, plannedValue: 34320, reactiveValue: 21120, plannedDeferred: 12 },
  { label: "Oct", plannedJobs: 141, reactiveJobs: 62, plannedValue: 31020, reactiveValue: 27280, plannedDeferred: 18 },
  { label: "Nov", plannedJobs: 128, reactiveJobs: 79, plannedValue: 28160, reactiveValue: 34760, plannedDeferred: 24 },
  { label: "Dec", plannedJobs: 96, reactiveJobs: 104, plannedValue: 21120, reactiveValue: 45760, plannedDeferred: 34 },
  { label: "Jan", plannedJobs: 88, reactiveJobs: 121, plannedValue: 19360, reactiveValue: 53240, plannedDeferred: 41 },
  { label: "Feb", plannedJobs: 94, reactiveJobs: 112, plannedValue: 20680, reactiveValue: 49280, plannedDeferred: 38 },
  { label: "Mar", plannedJobs: 108, reactiveJobs: 98, plannedValue: 23760, reactiveValue: 43120, plannedDeferred: 31 },
  { label: "Apr", plannedJobs: 121, reactiveJobs: 84, plannedValue: 26620, reactiveValue: 36960, plannedDeferred: 26 },
  { label: "May", plannedJobs: 134, reactiveJobs: 71, plannedValue: 29480, reactiveValue: 31240, plannedDeferred: 21 },
  { label: "Jun", plannedJobs: 142, reactiveJobs: 66, plannedValue: 31240, reactiveValue: 29040, plannedDeferred: 19 },
  { label: "Jul", plannedJobs: 139, reactiveJobs: 74, plannedValue: 30580, reactiveValue: 32560, plannedDeferred: 22 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planned and reactive</CardTitle>
        <CardDescription>The premium, and the visit it displaced</CardDescription>
      </CardHeader>
      <CardContent>
        <EmergencyMix months={months} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A deferred service is next month's emergency <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
