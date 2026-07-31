import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SourceApportionment } from "@/components/charts/lib/airquality"
const periods = ["Winter", "Spring", "Summer", "Autumn"]
const sources = ["Traffic exhaust", "Brake and tyre", "Domestic burning", "Secondary, imported", "Industry", "Natural"]
const contributions = [
  [3.4, 2.1, 6.8, 8.2, 1.4, 0.6],
  [3.1, 2.0, 1.9, 9.6, 1.3, 1.1],
  [2.8, 1.9, 0.4, 7.1, 1.2, 1.4],
  [3.3, 2.1, 3.6, 8.0, 1.3, 0.8],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source apportionment</CardTitle>
        <CardDescription>What a local plan can actually move</CardDescription>
      </CardHeader>
      <CardContent>
        <SourceApportionment
          periods={periods}
          sources={sources}
          contributions={contributions}
          controllable={["Traffic exhaust", "Brake and tyre", "Domestic burning"]}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most of it is not local <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          PM₂.₅ by season
        </div>
      </CardFooter>
    </Card>
  )
}
