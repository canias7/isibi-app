import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CoalitionSpace } from "@/components/charts/lib/elections"
const parties = [
  { name: "Blue", seats: 268 }, { name: "Red", seats: 241 },
  { name: "Green", seats: 62 }, { name: "Amber", seats: 39 },
  { name: "Regional", seats: 29 },
]
const excluded: [string, string][] = [["Blue", "Red"], ["Blue", "Green"]]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coalition arithmetic</CardTitle>
        <CardDescription>Every minimal winning combination</CardDescription>
      </CardHeader>
      <CardContent>
        <CoalitionSpace parties={parties} totalSeats={648} excluded={excluded} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Enumeration, not a preferred answer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Two pairings ruled out
        </div>
      </CardFooter>
    </Card>
  )
}
