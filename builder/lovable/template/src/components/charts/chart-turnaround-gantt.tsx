import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TurnaroundGantt } from "@/components/charts/lib/aviation"
const tasks = [
  { name: "Chocks on", minutes: 1 },
  { name: "Airbridge", minutes: 3, after: ["Chocks on"] },
  { name: "Deplane", minutes: 11, after: ["Airbridge"] },
  { name: "Cabin clean", minutes: 14, after: ["Deplane"] },
  { name: "Catering", minutes: 12, after: ["Deplane"] },
  { name: "Security search", minutes: 6, after: ["Cabin clean"] },
  { name: "Board", minutes: 17, after: ["Security search", "Catering"] },
  { name: "Unload hold", minutes: 9, after: ["Chocks on"] },
  { name: "Load hold", minutes: 12, after: ["Unload hold"] },
  { name: "Refuel", minutes: 15, after: ["Chocks on"] },
  { name: "Loadsheet", minutes: 4, after: ["Board", "Load hold", "Refuel"] },
  { name: "Doors closed", minutes: 2, after: ["Loadsheet"] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnaround</CardTitle>
        <CardDescription>The critical path solved from the dependencies</CardDescription>
      </CardHeader>
      <CardContent>
        <TurnaroundGantt tasks={tasks} scheduledMinutes={45} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It is long before anything goes wrong <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          45 minutes scheduled
        </div>
      </CardFooter>
    </Card>
  )
}
