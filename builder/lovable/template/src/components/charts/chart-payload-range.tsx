import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PayloadRange } from "@/components/charts/lib/aero"
const points = [
  { range: 0, payload: 20.5, note: "max payload" },
  { range: 2900, payload: 20.5, note: "first break" },
  { range: 4100, payload: 12.8, note: "max fuel" },
  { range: 5300, payload: 0, note: "ferry" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payload and range</CardTitle>
        <CardDescription>What it carries, how far</CardDescription>
      </CardHeader>
      <CardContent>
        <PayloadRange points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Past the first break, miles cost payload <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Narrowbody, typical
        </div>
      </CardFooter>
    </Card>
  )
}
