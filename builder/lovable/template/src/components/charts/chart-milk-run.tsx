import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MilkRun } from "@/components/charts/lib/logistics"
const stops = [
  { name: "Northgate DC", windowFrom: 6.5, windowTo: 7.5, arrival: 6.7 },
  { name: "Eastfield", windowFrom: 8, windowTo: 9, arrival: 7.6 },
  { name: "Harbour", windowFrom: 9.5, windowTo: 10.5, arrival: 10.1 },
  { name: "Southmoor", windowFrom: 11, windowTo: 12, arrival: 12.6 },
  { name: "Westbrook", windowFrom: 13, windowTo: 14, arrival: 13.4 },
  { name: "Return", windowFrom: 15, windowTo: 16, arrival: 15.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The round against its windows</CardTitle>
        <CardDescription>Early is a miss too</CardDescription>
      </CardHeader>
      <CardContent>
        <MilkRun stops={stops} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The dock is not ready either way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Morning round
        </div>
      </CardFooter>
    </Card>
  )
}
