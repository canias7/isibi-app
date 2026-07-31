import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RebookRate } from "@/components/charts/lib/salon"
const stylists = [
  { name: "Nadia", clients: 158, rebooked: 121 },
  { name: "Amara", clients: 210, rebooked: 142 },
  { name: "Joss", clients: 196, rebooked: 88 },
  { name: "Ellis", clients: 174, rebooked: 44 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rebooking</CardTitle>
        <CardDescription>Asked for in four seconds at the door</CardDescription>
      </CardHeader>
      <CardContent>
        <RebookRate stylists={stylists} meanSpend={58} rebookedWeeks={6} walkOutWeeks={11} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rhythm, not a reminder <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
