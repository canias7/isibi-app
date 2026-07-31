import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwotGrid, OkrTree, MetroMap, SeatingChart, ResourceHistogram } from "./lib/org2"

const keyResults = [
  { label: "400 bookings a month", progress: 0.67 },
  { label: "Rebooking rate to 55%", progress: 0.34 },
  { label: "Rating stays above 4.6", progress: 1 },
  { label: "Colour to 25% of revenue", progress: 0.52 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OKR Tree</CardTitle>
        <CardDescription>One objective, its key results, the honest mean.</CardDescription>
      </CardHeader>
      <CardContent>
        <OkrTree objective="Fill the second chair" keyResults={keyResults} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Held back by the rebooking rate <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
