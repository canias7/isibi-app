import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpaghettiDiagram } from "@/components/charts/lib/mfg"
const stations = [
  { label: "Store", x: 14, y: 18 },
  { label: "Cut", x: 52, y: 14 },
  { label: "Press", x: 84, y: 30 },
  { label: "Weld", x: 78, y: 66 },
  { label: "QC", x: 44, y: 78 },
  { label: "Pack", x: 16, y: 62 },
]
const walk = ["Store", "Cut", "Store", "Press", "Weld", "QC", "Press", "Weld", "QC", "Pack", "Store", "Pack"]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator movement</CardTitle>
        <CardDescription>The route actually walked</CardDescription>
      </CardHeader>
      <CardContent>
        <SpaghettiDiagram stations={stations} path={walk} metresPerUnit={0.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Five stations visited more than once <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One assembly cycle
        </div>
      </CardFooter>
    </Card>
  )
}
