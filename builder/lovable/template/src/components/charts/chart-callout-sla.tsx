import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalloutSla } from "@/components/charts/lib/fieldservice"
const priorities = [
  {
    name: "P1 · no heating, vulnerable",
    promisedHours: 4,
    penaltyPerBreach: 250,
    responses: [1.2, 1.8, 2.1, 2.4, 2.6, 2.9, 3.1, 3.3, 3.4, 3.6, 3.8, 3.9, 4.6, 5.2, 7.8],
  },
  {
    name: "P2 · no hot water",
    promisedHours: 24,
    penaltyPerBreach: 90,
    responses: [3, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 26, 31, 44],
  },
  {
    name: "P3 · routine repair",
    promisedHours: 120,
    penaltyPerBreach: 40,
    responses: [18, 26, 34, 41, 48, 55, 61, 68, 74, 81, 88, 94, 101, 109, 116, 118, 134, 151],
  },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Response</CardTitle>
        <CardDescription>Every call, against its own promise</CardDescription>
      </CardHeader>
      <CardContent>
        <CalloutSla priorities={priorities} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A monthly average pays out nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Service contracts
        </div>
      </CardFooter>
    </Card>
  )
}
