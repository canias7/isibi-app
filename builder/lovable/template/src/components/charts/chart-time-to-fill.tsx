import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TimeToFill } from "@/components/charts/lib/recruiting"
const stages = [
  { name: "Approval", waitShare: 0.92 },
  { name: "Sourcing", waitShare: 0.18 },
  { name: "Screen", waitShare: 0.44 },
  { name: "Awaiting panel", waitShare: 0.96 },
  { name: "Interviews", waitShare: 0.31 },
  { name: "Offer to accept", waitShare: 0.78 },
]
const roles = [
  { name: "Backend engineer", days: [11, 9, 4, 14, 6, 8] },
  { name: "Data analyst", days: [6, 12, 5, 9, 8, 6] },
  { name: "Product designer", days: [18, 14, 6, 21, 9, 11] },
  { name: "Finance manager", days: [9, 7, 3, 8, 5, 12] },
  { name: "Support lead", days: [4, 6, 3, 6, 4, 5] },
  { name: "Head of platform", days: [24, 21, 8, 28, 14, 17] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time to fill</CardTitle>
        <CardDescription>Queue split out from work</CardDescription>
      </CardHeader>
      <CardContent>
        <TimeToFill roles={roles} stages={stages} targetDays={45} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every waiting day is between two people's calendars <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six open roles
        </div>
      </CardFooter>
    </Card>
  )
}
