import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SlopeChart, SERVICE_SLOPES } from "./lib/slope"

const items = [
  { label: "Weekday", from: 320, to: 298 },
  { label: "Weekend", from: 254, to: 341, emphasise: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slope</CardTitle>
        <CardDescription>Just two series.</CardDescription>
      </CardHeader>
      <CardContent>
        <SlopeChart items={items} fromLabel="H1" toLabel="H2" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Weekends overtook weekdays <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
