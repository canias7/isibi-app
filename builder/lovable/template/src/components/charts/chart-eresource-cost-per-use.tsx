import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EresourceCostPerUse } from "@/components/charts/lib/libraries"
const resources = [
  { name: "Major publisher package", annualCost: 148000, sessions: 41000, downloads: 96000, renewsIn: 4 },
  { name: "Legal database", annualCost: 62000, sessions: 3100, downloads: 1800, renewsIn: 9 },
  { name: "Newspaper archive", annualCost: 18000, sessions: 8600, downloads: 2400, renewsIn: 2 },
  { name: "Streaming film", annualCost: 24000, sessions: 1400, downloads: 0, renewsIn: 11 },
  { name: "Language learning", annualCost: 9800, sessions: 12400, downloads: 0, renewsIn: 6 },
  { name: "Specialist STM title set", annualCost: 41000, sessions: 620, downloads: 940, renewsIn: 1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>E-resources</CardTitle>
        <CardDescription>Cost per use, not cost</CardDescription>
      </CardHeader>
      <CardContent>
        <EresourceCostPerUse resources={resources} benchmarkPerUse={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The biggest invoice and the worst value are rarely the same <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Renewal review
        </div>
      </CardFooter>
    </Card>
  )
}
