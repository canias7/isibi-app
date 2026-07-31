import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HivePlot, Bipartite, VoronoiMap, FlameGraph, EdgeBundling, CoOccurrence } from "./lib/graphs"

const axes = ["Customers", "Staff", "Services"]
const nodes = [
  { id: "Ada", axis: "Customers", rank: 3 }, { id: "Mo", axis: "Customers", rank: 2 },
  { id: "Sam", axis: "Customers", rank: 1 },
  { id: "Rae", axis: "Staff", rank: 3 }, { id: "Jo", axis: "Staff", rank: 2 },
  { id: "Kit", axis: "Staff", rank: 1 },
  { id: "Cut", axis: "Services", rank: 3 }, { id: "Beard", axis: "Services", rank: 2 },
  { id: "Colour", axis: "Services", rank: 1 },
]
const links = [
  { source: "Ada", target: "Rae", value: 5 }, { source: "Ada", target: "Cut", value: 4 },
  { source: "Mo", target: "Jo", value: 3 }, { source: "Mo", target: "Beard", value: 2 },
  { source: "Sam", target: "Kit", value: 2 }, { source: "Sam", target: "Colour", value: 3 },
  { source: "Rae", target: "Cut", value: 6 }, { source: "Jo", target: "Beard", value: 4 },
  { source: "Kit", target: "Colour", value: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hive Plot</CardTitle>
        <CardDescription>Nodes pinned to axes by role, not scattered.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <HivePlot axes={axes} nodes={nodes} links={links} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Stylists sit between both sides <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
