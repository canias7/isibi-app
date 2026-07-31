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

const lines = [
  { label: "North line", stops: [
    { x: 10, y: 80, label: "Depot" }, { x: 30, y: 60 }, { x: 50, y: 50, label: "Centre", interchange: true },
    { x: 70, y: 40 }, { x: 88, y: 22, label: "Hilltop" },
  ] },
  { label: "River line", dash: "5 3", stops: [
    { x: 12, y: 20, label: "West Pier" }, { x: 32, y: 34 }, { x: 50, y: 50, interchange: true },
    { x: 68, y: 66 }, { x: 86, y: 80, label: "East Dock" },
  ] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metro Map</CardTitle>
        <CardDescription>A schematic network with interchanges.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <MetroMap lines={lines} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two lines cross at Centre <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
